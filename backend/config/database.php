<?php
// Prevent CORS issues when React talks to PHP
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

// Handle preflight requests
if (isset($_SERVER['REQUEST_METHOD']) && $_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    http_response_code(200);
    exit();
}

class Database {
    private $host;
    private $db_name;
    private $username;
    private $password;
    private $port;
    private $sslmode;
    public $conn;

    public function __construct() {
        // Load .env variables
        $dotenv_path = __DIR__ . '/../vendor/autoload.php';
        if (file_exists($dotenv_path)) {
            require_once $dotenv_path;
            $dotenv = Dotenv\Dotenv::createImmutable(__DIR__ . '/../');
            $dotenv->safeLoad();
        }

        // Assign from ENV or fallback to localhost defaults
        // Dotenv populates $_ENV locally. Render supplies values through the
        // process environment, so support both without exposing any secrets.
        $this->host = getenv('DB_HOST') ?: ($_ENV['DB_HOST'] ?? "localhost");
        $this->db_name = getenv('DB_NAME') ?: ($_ENV['DB_NAME'] ?? "smarthoa_db");
        $this->username = getenv('DB_USER') ?: ($_ENV['DB_USER'] ?? "root");
        $this->password = getenv('DB_PASS') ?: ($_ENV['DB_PASS'] ?? "");
        $this->port = getenv('DB_PORT') ?: ($_ENV['DB_PORT'] ?? "5432");
        $this->sslmode = getenv('DB_SSLMODE') ?: ($_ENV['DB_SSLMODE'] ?? null);
    }

    public function getConnection() {
        $this->conn = null;
        try {
            // Updated for Supabase (PostgreSQL)
            $dsn = "pgsql:host=" . $this->host . ";port=" . $this->port . ";dbname=" . $this->db_name;
            if (!empty($this->sslmode)) {
                $dsn .= ";sslmode=" . $this->sslmode;
            }
            $this->conn = new PDO($dsn, $this->username, $this->password);
            $this->conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        } catch(PDOException $exception) {
            // Keep connection details (which can include credentials) out of
            // public API responses while preserving diagnostics in server logs.
            error_log("SmartHOA database connection error: " . $exception->getMessage());
            http_response_code(500);
            echo json_encode(["message" => "Database connection is temporarily unavailable. Please try again later."]);
            exit();
        }
        return $this->conn;
    }
}
?>
