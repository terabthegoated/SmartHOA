<?php
/** Validate the optional image before any complaint/database writes happen. */
function validate_complaint_image($file) {
    if ($file === null || ($file['error'] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_NO_FILE) return null;
    if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
        throw new InvalidArgumentException('The attachment could not be uploaded. Choose a JPEG, PNG or WebP image up to 5 MB.');
    }
    $path = $file['tmp_name'] ?? '';
    if (!is_string($path) || !is_file($path) || filesize($path) === 0 || filesize($path) > 5 * 1024 * 1024) {
        throw new InvalidArgumentException('Attachment must be an image no larger than 5 MB.');
    }
    $mime = (new finfo(FILEINFO_MIME_TYPE))->file($path);
    $extensions = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'];
    if (!isset($extensions[$mime]) || @getimagesize($path) === false) {
        throw new InvalidArgumentException('Attachment must be a valid JPEG, PNG or WebP image.');
    }
    return ['tmp_name' => $path, 'extension' => $extensions[$mime]];
}
