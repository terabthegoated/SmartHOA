<?php
/** Billing period and payment deadline are distinct. Older clients omit the period. */
function bill_billing_month($input, DateTimeImmutable $dueDate) {
    $input = trim((string) $input);
    if ($input === '') return $dueDate->format('Y-m-01');
    if (!preg_match('/^(?!0000)\d{4}-(0[1-9]|1[0-2])(?:-\d{2})?$/D', $input)) {
        throw new InvalidArgumentException('Choose a valid billing month (YYYY-MM).');
    }
    $value = strlen($input) === 7 ? $input . '-01' : $input;
    $date = DateTimeImmutable::createFromFormat('!Y-m-d', $value, new DateTimeZone('Asia/Manila'));
    $errors = DateTimeImmutable::getLastErrors();
    if (!$date || ($errors !== false && ($errors['warning_count'] > 0 || $errors['error_count'] > 0)) || $date->format('Y-m-d') !== $value) {
        throw new InvalidArgumentException('Choose a valid billing month (YYYY-MM).');
    }
    return $date->format('Y-m-01');
}
