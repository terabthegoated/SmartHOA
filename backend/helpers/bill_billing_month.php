<?php
/** New manual bills always use the deadline's calendar month and year. */
function bill_due_date($input) {
    if (!preg_match('/^(?!0000)\d{4}-(0[1-9]|1[0-2])-\d{2}$/D', $input)) {
        throw new InvalidArgumentException('Due date must be a valid date in YYYY-MM-DD format.');
    }
    $date = DateTimeImmutable::createFromFormat('!Y-m-d', $input, new DateTimeZone('Asia/Manila'));
    $errors = DateTimeImmutable::getLastErrors();
    if (!$date || ($errors !== false && ($errors['warning_count'] > 0 || $errors['error_count'] > 0)) || $date->format('Y-m-d') !== $input) {
        throw new InvalidArgumentException('Due date must be a valid date in YYYY-MM-DD format.');
    }
    return $date;
}

function bill_billing_month(DateTimeImmutable $dueDate) {
    return $dueDate->format('Y-m-01');
}
