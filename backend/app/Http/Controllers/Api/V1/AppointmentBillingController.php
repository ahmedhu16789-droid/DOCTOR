<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\Api\V1\AppointmentResource;
use App\Models\Appointment;
use App\Models\FinancialAuditLog;
use App\Models\Invoice;
use App\Models\InvoiceItem;
use App\Models\Transaction;
use App\Services\DoctorEarningsCalculator;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rule;
use RuntimeException;

class AppointmentBillingController extends Controller
{
    public function __construct(private readonly DoctorEarningsCalculator $doctorEarningsCalculator)
    {
    }

    public function addItem(Request $request, Appointment $appointment): JsonResponse
    {
        abort_unless($appointment->clinic_id === $request->user()->clinic_id, 404);

        $validated = $request->validate([
            'serviceId' => ['nullable', 'string', 'max:100'],
            'name' => ['required', 'string', 'max:255'],
            'category' => ['required', 'string', Rule::in(InvoiceItem::ALLOWED_CATEGORIES)],
            'quantity' => ['nullable', 'integer', 'min:1', 'max:100'],
            'unitPrice' => ['required', 'numeric', 'min:0'],
            'reason' => ['nullable', 'string', 'max:1000'],
        ]);

        DB::transaction(function () use ($request, $appointment, $validated): void {
            $invoice = $appointment->invoice;
            abort_if(! $invoice, 422, 'Appointment invoice was not initialized.');
            $this->assertInvoiceMutable($invoice);

            $quantity = (int) ($validated['quantity'] ?? 1);
            $unitPrice = (float) $validated['unitPrice'];

            $item = InvoiceItem::query()->create([
                'clinic_id' => $request->user()->clinic_id,
                'invoice_id' => $invoice->id,
                'service_id' => $validated['serviceId'] ?? null,
                'name' => $validated['name'],
                'category' => $validated['category'],
                'quantity' => $quantity,
                'unit_price' => $unitPrice,
                'total' => $quantity * $unitPrice,
                'added_by' => $request->user()->id,
            ]);

            $this->recalculateInvoice($invoice);
            $this->writeAuditLog($request, $invoice, 'INVOICE_ITEM_ADDED', $item, null, $item->toArray(), $validated['reason'] ?? null);
        });

        $appointment->load('invoice.items', 'invoice.auditLogs.actor');

        return response()->json(['data' => new AppointmentResource($appointment)]);
    }

    public function updateItem(Request $request, Appointment $appointment, InvoiceItem $item): JsonResponse
    {
        abort_unless($appointment->clinic_id === $request->user()->clinic_id, 404);
        abort_unless($appointment->invoice && $item->invoice_id === $appointment->invoice->id, 404);

        $validated = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'category' => ['sometimes', 'string', Rule::in(InvoiceItem::ALLOWED_CATEGORIES)],
            'quantity' => ['sometimes', 'integer', 'min:1', 'max:100'],
            'unitPrice' => ['sometimes', 'numeric', 'min:0'],
            'reason' => ['nullable', 'string', 'max:1000'],
        ]);

        DB::transaction(function () use ($request, $appointment, $item, $validated): void {
            $invoice = $appointment->invoice;
            $this->assertInvoiceMutable($invoice);

            $before = $item->toArray();
            $item->fill([
                'name' => $validated['name'] ?? $item->name,
                'category' => $validated['category'] ?? $item->category,
                'quantity' => isset($validated['quantity']) ? (int) $validated['quantity'] : $item->quantity,
                'unit_price' => isset($validated['unitPrice']) ? (float) $validated['unitPrice'] : $item->unit_price,
            ]);
            $item->total = (float) $item->quantity * (float) $item->unit_price;
            $item->save();

            $this->recalculateInvoice($invoice);
            $this->writeAuditLog($request, $invoice, 'INVOICE_ITEM_UPDATED', $item, $before, $item->toArray(), $validated['reason'] ?? null);
        });

        $appointment->load('invoice.items', 'invoice.auditLogs.actor');

        return response()->json(['data' => new AppointmentResource($appointment)]);
    }

    public function processPayment(Request $request, Appointment $appointment): JsonResponse
    {
        abort_unless($appointment->clinic_id === $request->user()->clinic_id, 404);

        $validated = $request->validate([
            'amount' => ['nullable', 'numeric', 'gt:0'],
            'method' => ['nullable', 'string', 'max:100'],
            'payments' => ['nullable', 'array', 'min:1'],
            'payments.*.amount' => ['required_with:payments', 'numeric', 'gt:0'],
            'payments.*.method' => ['nullable', 'string', 'max:100'],
            'reason' => ['nullable', 'string', 'max:1000'],
        ]);

        if (! isset($validated['payments']) && ! isset($validated['amount'])) {
            abort(422, 'Payment amount is required.');
        }

        DB::transaction(function () use ($request, $appointment, $validated): void {
            $invoice = $appointment->invoice;
            abort_if(! $invoice, 422, 'Appointment invoice was not initialized.');
            $this->assertInvoiceMutable($invoice);

            $payments = collect($validated['payments'] ?? [[
                'amount' => $validated['amount'],
                'method' => $validated['method'] ?? null,
            ]]);

            $amount = (float) $payments->sum(fn (array $payment): float => (float) $payment['amount']);
            $remaining = max(0.0, (float) $invoice->total - (float) $invoice->paid_amount);
            abort_if($amount > $remaining, 422, 'Payment amount exceeds outstanding balance.');

            $invoice->paid_amount = (float) $invoice->paid_amount + $amount;
            $this->recalculateInvoice($invoice);

            $payments->each(function (array $payment) use ($request, $appointment, $invoice, $validated): void {
                $transaction = Transaction::query()->create([
                    'clinic_id' => $request->user()->clinic_id,
                    'invoice_id' => $invoice->id,
                    'amount' => (float) $payment['amount'],
                    'method' => $payment['method'] ?? null,
                    'paid_at' => now(),
                ]);

                $this->writeAuditLog($request, $invoice, 'PAYMENT_CREATED', $transaction, null, $transaction->toArray(), $validated['reason'] ?? null);

                try {
                    $this->doctorEarningsCalculator->recordForPayment($appointment, $invoice, $transaction);
                } catch (RuntimeException $exception) {
                    Log::warning('Skipping doctor earnings ledger creation during payment processing.', [
                        'appointment_id' => $appointment->id,
                        'invoice_id' => $invoice->id,
                        'transaction_id' => $transaction->id,
                        'message' => $exception->getMessage(),
                    ]);
                }
            });
        });

        $appointment->load('invoice.items', 'invoice.transactions', 'invoice.auditLogs.actor');

        return response()->json(['data' => new AppointmentResource($appointment)]);
    }

    public function removeItem(Request $request, Appointment $appointment, InvoiceItem $item): JsonResponse
    {
        abort_unless($appointment->clinic_id === $request->user()->clinic_id, 404);
        abort_unless($appointment->invoice && $item->invoice_id === $appointment->invoice->id, 404);

        $validated = $request->validate([
            'reason' => ['nullable', 'string', 'max:1000'],
        ]);

        DB::transaction(function () use ($request, $appointment, $item, $validated): void {
            $invoice = $appointment->invoice;
            $this->assertInvoiceMutable($invoice);

            $before = $item->toArray();
            $item->delete();
            $this->recalculateInvoice($invoice);
            $this->writeAuditLog($request, $invoice, 'INVOICE_ITEM_REMOVED', $item, $before, null, $validated['reason'] ?? null);
        });

        $appointment->load('invoice.items', 'invoice.auditLogs.actor');

        return response()->json(['data' => new AppointmentResource($appointment)]);
    }

    public function finalize(Request $request, Appointment $appointment): JsonResponse
    {
        abort_unless($appointment->clinic_id === $request->user()->clinic_id, 404);

        $validated = $request->validate([
            'reason' => ['nullable', 'string', 'max:1000'],
        ]);

        DB::transaction(function () use ($request, $appointment, $validated): void {
            $invoice = $appointment->invoice;
            abort_if(! $invoice, 422, 'Appointment invoice was not initialized.');
            abort_if(! $invoice->canFinalize(), 422, 'Invoice is not in a state that can be finalized.');

            $before = $invoice->toArray();
            $invoice->lifecycle_state = Invoice::LIFECYCLE_FINALIZED;
            $invoice->save();

            $this->writeAuditLog($request, $invoice, 'INVOICE_FINALIZED', $invoice, $before, $invoice->toArray(), $validated['reason'] ?? null);
        });

        $appointment->load('invoice.items', 'invoice.transactions', 'invoice.auditLogs.actor');

        return response()->json(['data' => new AppointmentResource($appointment)]);
    }

    public function reverseFinalization(Request $request, Appointment $appointment): JsonResponse
    {
        abort_unless($appointment->clinic_id === $request->user()->clinic_id, 404);

        $validated = $request->validate([
            'reason' => ['required', 'string', 'max:1000'],
        ]);

        DB::transaction(function () use ($request, $appointment, $validated): void {
            $invoice = $appointment->invoice;
            abort_if(! $invoice, 422, 'Appointment invoice was not initialized.');
            abort_if(! $invoice->canReverseFinalization(), 422, 'Only finalized invoices can be reversed.');

            $before = $invoice->toArray();
            $invoice->lifecycle_state = Invoice::LIFECYCLE_DRAFT;
            $invoice->save();

            $this->writeAuditLog($request, $invoice, 'INVOICE_FINALIZATION_REVERSED', $invoice, $before, $invoice->toArray(), $validated['reason']);
        });

        $appointment->load('invoice.items', 'invoice.transactions', 'invoice.auditLogs.actor');

        return response()->json(['data' => new AppointmentResource($appointment)]);
    }

    public function void(Request $request, Appointment $appointment): JsonResponse
    {
        abort_unless($appointment->clinic_id === $request->user()->clinic_id, 404);

        $validated = $request->validate([
            'reason' => ['required', 'string', 'max:1000'],
        ]);

        DB::transaction(function () use ($request, $appointment, $validated): void {
            $invoice = $appointment->invoice;
            abort_if(! $invoice, 422, 'Appointment invoice was not initialized.');
            abort_if(! $invoice->canVoid(), 422, 'Invoice is already voided.');

            $before = $invoice->toArray();
            $invoice->lifecycle_state = Invoice::LIFECYCLE_VOIDED;
            $invoice->save();

            $this->writeAuditLog($request, $invoice, 'INVOICE_VOIDED', $invoice, $before, $invoice->toArray(), $validated['reason']);
        });

        $appointment->load('invoice.items', 'invoice.transactions', 'invoice.auditLogs.actor');

        return response()->json(['data' => new AppointmentResource($appointment)]);
    }

    private function assertInvoiceMutable(Invoice $invoice): void
    {
        abort_if(
            ! $invoice->canMutateFinancials(),
            422,
            'Invoice is finalized and cannot be edited directly. Use the reversal flow before mutating items or payments.'
        );
    }

    private function writeAuditLog(
        Request $request,
        Invoice $invoice,
        string $actionType,
        object $target,
        ?array $beforeSnapshot,
        ?array $afterSnapshot,
        ?string $reason
    ): void {
        FinancialAuditLog::query()->create([
            'clinic_id' => $request->user()->clinic_id,
            'invoice_id' => $invoice->id,
            'actor_id' => $request->user()->id,
            'action_type' => $actionType,
            'target_entity_type' => class_basename($target),
            'target_entity_id' => (string) ($target->id ?? ''),
            'before_snapshot' => $beforeSnapshot,
            'after_snapshot' => $afterSnapshot,
            'reason' => $reason,
            'occurred_at' => now(),
        ]);
    }

    private function recalculateInvoice(Invoice $invoice): void
    {
        $subtotal = (float) $invoice->items()->sum('total');
        $invoice->total = $subtotal;
        $invoice->status = $invoice->paid_amount >= $subtotal
            ? Invoice::BILLING_PAID
            : ($invoice->paid_amount > 0 ? Invoice::BILLING_PARTIAL : Invoice::BILLING_UNPAID);
        $invoice->save();
    }
}
