<?php

namespace App\Support;

class BranchSettingsResolver
{
    public const PRECEDENCE = 'branch_override > clinic_default > system_default';

    public static function systemDefaults(): array
    {
        return [
            'defaultSlotDurationMinutes' => 20,
            'workingHours' => [
                'start' => '09:00',
                'end' => '17:00',
                'days' => [1, 2, 3, 4, 5],
            ],
            'queueRules' => [
                'maxWaitingPatients' => 25,
                'allowOverbooking' => false,
                'autoCallEnabled' => true,
            ],
            'operationalFlags' => [
                'allowWalkIns' => true,
                'enableTelehealth' => false,
                'requirePrepayment' => false,
            ],
        ];
    }

    public static function resolve(?array $clinicSettings, ?array $branchOverrides): array
    {
        $systemDefaults = self::systemDefaults();
        $clinicDefaults = is_array($clinicSettings['branchDefaults'] ?? null)
            ? $clinicSettings['branchDefaults']
            : [];

        return [
            'precedence' => self::PRECEDENCE,
            'defaults' => array_replace_recursive($systemDefaults, $clinicDefaults),
            'overrides' => $branchOverrides ?? [],
            'effective' => array_replace_recursive($systemDefaults, $clinicDefaults, $branchOverrides ?? []),
        ];
    }
}
