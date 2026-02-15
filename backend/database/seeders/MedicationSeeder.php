<?php

namespace Database\Seeders;

use App\Models\Medication;
use Illuminate\Database\Seeder;

class MedicationSeeder extends Seeder
{
    public function run(): void
    {
        $rows = [
            ['name' => 'Panadol', 'active_ingredient' => 'Paracetamol', 'form' => 'Tablet', 'strength' => '500mg'],
            ['name' => 'Adol', 'active_ingredient' => 'Paracetamol', 'form' => 'Tablet', 'strength' => '500mg'],
            ['name' => 'Augmentin', 'active_ingredient' => 'Amoxicillin / Clavulanate', 'form' => 'Tablet', 'strength' => '1g'],
            ['name' => 'Cataflam', 'active_ingredient' => 'Diclofenac Potassium', 'form' => 'Tablet', 'strength' => '50mg'],
            ['name' => 'Brufen', 'active_ingredient' => 'Ibuprofen', 'form' => 'Tablet', 'strength' => '400mg'],
            ['name' => 'Concor', 'active_ingredient' => 'Bisoprolol', 'form' => 'Tablet', 'strength' => '5mg'],
            ['name' => 'Norvasc', 'active_ingredient' => 'Amlodipine', 'form' => 'Tablet', 'strength' => '5mg'],
        ];

        foreach ($rows as $row) {
            Medication::query()->firstOrCreate([
                'name' => $row['name'],
                'active_ingredient' => $row['active_ingredient'],
            ], $row);
        }
    }
}
