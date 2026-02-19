<?php

return [
    // COLLECTED_AMOUNT => commission calculated from actual payment transaction amount.
    // NET_INVOICE => commission calculated from invoice net total.
    'commission_basis_policy' => env('PAYROLL_COMMISSION_BASIS_POLICY', 'COLLECTED_AMOUNT'),
];
