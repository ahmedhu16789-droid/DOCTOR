<?php

$url = 'http://localhost:8000/api/v1/auth/login';
$data = [
    'email' => 'owner@alfath-clinic.com',
    'password' => 'password123'
];

$options = [
    'http' => [
        'header'  => "Content-type: application/json\r\n" .
                     "Accept: application/json\r\n",
        'method'  => 'POST',
        'content' => json_encode($data),
        'ignore_errors' => true 
    ]
];

$context  = stream_context_create($options);
$result = file_get_contents($url, false, $context);

echo "Response Headers:\n";
print_r($http_response_header);

echo "\nResponse Body:\n";
echo $result;
