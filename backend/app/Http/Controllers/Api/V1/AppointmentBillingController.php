<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\Api\V1\AppointmentResource;
use App\Models\Appointment;
use App\Models\InvoiceItem;
use Illuminate\Validation\Rule;
use App\Models\Transaction;
use App\Services\DoctorEarningsCalculator;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;
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
        ]);

        DB::transaction(function () use ($request, $appointment, $validated): void {
            $invoice = $appointment->invoice;
            abort_if(! $invoice, 422, 'Appointment invoice was not initialized.');

            $quantity = (int) ($validated['quantity'] ?? 1);
            $unitPrice = (float) $validated['unitPrice'];

            InvoiceItem::query()->create([
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
        });

        $appointment->load('invoice.items');

        return response()->json(['data' => new AppointmentResource($appointment)]);
    }


    public function processPayment(Request $request, Appointment $appointment): JsonResponse
    {
        abort_unless($appointment->clinic_id === $request->user()->clinic_id, 404);

        $validated = $request->validate([
            'amount' => ['required', 'numeric', 'gt:0'],
            'method' => ['nullable', 'string', 'max:100'],
        ]);

        DB::transaction(function () use ($request, $appointment, $validated): void {
            $invoice = $appointment->invoice;
            abort_if(! $invoice, 422, 'Appointment invoice was not initialized.');

            $amount = (float) $validated['amount'];
            $remaining = max(0.0, (float) $invoice->total - (float) $invoice->paid_amount);
            abort_if($amount > $remaining, 422, 'Payment amount exceeds outstanding balance.');

            $invoice->paid_amount = (float) $invoice->paid_amount + $amount;
            $this->recalculateInvoice($invoice);

            $transaction = Transaction::query()->create([
                'clinic_id' => $request->user()->clinic_id,
                'invoice_id' => $invoice->id,
                'amount' => $amount,
                'method' => $validated['method'] ?? null,
                'paid_at' => now(),
            ]);

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

        $appointment->load('invoice.items');

        return response()->json(['data' => new AppointmentResource($appointment)]);
    }

    public function removeItem(Request $request, Appointment $appointment, InvoiceItem $item): JsonResponse
    {
        abort_unless($appointment->clinic_id === $request->user()->clinic_id, 404);
        abort_unless($appointment->invoice && $item->invoice_id === $appointment->invoice->id, 404);

        DB::transaction(function () use ($appointment, $item): void {
            $item->delete();
            $this->recalculateInvoice($appointment->invoice);
        });

        $appointment->load('invoice.items');

        return response()->json(['data' => new AppointmentResource($appointment)]);
    }

    private function recalculateInvoice($invoice): void
    {
        $subtotal = (float) $invoice->items()->sum('total');
        $invoice->total = $subtotal;
        $invoice->status = $invoice->paid_amount >= $subtotal ? 'PAID' : ($invoice->paid_amount > 0 ? 'PARTIAL' : 'UNPAID');
        $invoice->save();
    }
}
