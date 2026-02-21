<?php

return [
    'branch_membership_bypass_roles' => ['ADMIN', 'HQ'],

    'branch_privileges' => [
        'READ' => ['ADMIN', 'HQ', 'BRANCH_MANAGER', 'DOCTOR', 'RECEPTIONIST', 'NURSE', 'PHARMACY_MANAGER', 'FINANCE_ADMIN'],
        'SCHEDULE_MANAGEMENT' => ['ADMIN', 'HQ', 'BRANCH_MANAGER', 'RECEPTIONIST'],
        'FINANCE' => ['ADMIN', 'HQ', 'FINANCE_ADMIN', 'BRANCH_MANAGER', 'RECEPTIONIST'],
        'CASH_SESSION' => ['ADMIN', 'HQ', 'FINANCE_ADMIN', 'BRANCH_MANAGER', 'RECEPTIONIST'],
    ],
];
