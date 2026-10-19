<?php
/** Same resolved-complaint rating flow, with ownership checked before saving. */
function save_complaint_feedback(PDO $db, $userId, $complaintId, $rating, $comment = null) {
    if (!is_numeric($rating) || (float) $rating !== (float) (int) $rating || $rating < 1 || $rating > 5) {
        throw new InvalidArgumentException('A rating from 1 to 5 is required.', 400);
    }
    $db->beginTransaction();
    try {
        $sql = "SELECT c.complaint_id, c.resident_id FROM complaints c
            JOIN resident_profiles rp ON c.resident_id = rp.resident_id
            WHERE c.complaint_id = ? AND rp.user_id = ?
              AND c.complaint_status IN ('Resolved', 'Closed')";
        if ($db->getAttribute(PDO::ATTR_DRIVER_NAME) === 'pgsql') $sql .= ' FOR UPDATE OF c';
        $stmt = $db->prepare($sql);
        $stmt->execute([$complaintId, $userId]);
        $complaint = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$complaint) throw new InvalidArgumentException('This complaint cannot be rated.', 404);
        $stmt = $db->prepare('SELECT feedback_id FROM feedback WHERE complaint_id = ? AND resident_id = ? ORDER BY submitted_at DESC LIMIT 1');
        $stmt->execute([$complaintId, $complaint['resident_id']]);
        $feedbackId = $stmt->fetchColumn();
        if ($feedbackId) {
            $db->prepare('UPDATE feedback SET rating = ?, comment = ?, submitted_at = CURRENT_TIMESTAMP WHERE feedback_id = ?')
                ->execute([(int) $rating, $comment ?: null, $feedbackId]);
        } else {
            $db->prepare('INSERT INTO feedback (complaint_id, resident_id, rating, comment) VALUES (?, ?, ?, ?)')
                ->execute([$complaintId, $complaint['resident_id'], (int) $rating, $comment ?: null]);
        }
        $db->commit();
    } catch (Throwable $error) {
        if ($db->inTransaction()) $db->rollBack();
        throw $error;
    }
}
