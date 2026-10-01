<?php

/**
 * Explainable, deterministic complaint-priority recommendation rules.
 *
 * The function intentionally uses only the resident's selected category and
 * submitted text. It never makes an enforcement decision: HOA officers retain
 * the ability to change the final priority with a recorded reason.
 */
function smart_hoa_normalize_priority_text($value) {
    $text = trim((string) $value);
    $text = function_exists('mb_strtolower') ? mb_strtolower($text, 'UTF-8') : strtolower($text);
    return preg_replace('/\s+/', ' ', $text) ?: '';
}

function smart_hoa_matched_priority_terms($text, array $terms) {
    $matches = array();
    foreach ($terms as $term) {
        if (strpos($text, $term) !== false) {
            $matches[] = $term;
        }
    }
    return array_values(array_unique($matches));
}

function smart_hoa_recommend_complaint_priority($categoryName, $title, $description) {
    $category = smart_hoa_normalize_priority_text($categoryName);
    $text = smart_hoa_normalize_priority_text($title . ' ' . $description);

    // Immediate danger indicators take precedence over all category-based rules.
    $criticalTerms = array(
        'fire', 'smoke', 'gas leak', 'gas smell', 'smell of gas', 'explosion',
        'electrocution', 'live wire', 'exposed wire', 'downed wire', 'fallen power line',
        'power line down', 'collapse', 'collapsed', 'sinkhole', 'armed intruder',
        'armed person', 'weapon', 'gun', 'assault in progress', 'immediate danger',
        'life threatening'
    );
    $criticalMatches = smart_hoa_matched_priority_terms($text, $criticalTerms);
    if (count($criticalMatches) > 0) {
        return array(
            'priority_level' => 'Critical',
            'rule_code' => 'CRITICAL_IMMEDIATE_SAFETY',
            'reason' => 'Critical: possible immediate safety risk detected (' . implode(', ', $criticalMatches) . '). Officers should verify and respond immediately.'
        );
    }

    // These indicate a security concern, a safety hazard, or a substantial
    // interruption of an essential community service.
    $highTerms = array(
        'intruder', 'break in', 'break-in', 'burglary', 'robbery', 'theft',
        'trespass', 'unauthorized person', 'harassment', 'threat', 'suspicious activity',
        'power outage', 'blackout', 'no electricity', 'electrical outage', 'no water',
        'water interruption', 'water leak', 'burst pipe', 'sewage', 'overflow',
        'open manhole', 'fallen tree', 'unsafe structure', 'structural damage'
    );
    $highMatches = smart_hoa_matched_priority_terms($text, $highTerms);
    if (count($highMatches) > 0) {
        return array(
            'priority_level' => 'High',
            'rule_code' => 'HIGH_RISK_OR_SERVICE_DISRUPTION',
            'reason' => 'High: the report indicates a security, safety, or essential-service concern (' . implode(', ', $highMatches) . ') that needs prompt officer review.'
        );
    }

    if ($category === 'security') {
        return array(
            'priority_level' => 'High',
            'rule_code' => 'HIGH_SECURITY_CATEGORY',
            'reason' => 'High: Security reports are prioritized for prompt officer review because they may affect resident safety or access control.'
        );
    }

    $operationalCategories = array('maintenance', 'utilities', 'parking', 'noise', 'cleanliness');
    if (in_array($category, $operationalCategories, true)) {
        return array(
            'priority_level' => 'Medium',
            'rule_code' => 'MEDIUM_OPERATIONAL_CATEGORY',
            'reason' => 'Medium: this is a standard ' . ucfirst($category) . ' issue that needs officer action, with no immediate safety or service-disruption indicator detected.'
        );
    }

    return array(
        'priority_level' => 'Low',
        'rule_code' => 'LOW_ROUTINE_REVIEW',
        'reason' => 'Low: the report does not match an immediate safety, security, or essential-service disruption rule. It can be reviewed in the normal queue.'
    );
}
