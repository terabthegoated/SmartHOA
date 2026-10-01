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
        $this->host = $_ENV['DB_HOST'] ?? "localhost";
        $this->db_name = $_ENV['DB_NAME'] ?? "smarthoa_db";
        $this->username = $_ENV['DB_USER'] ?? "root";
        $this->password = $_ENV['DB_PASS'] ?? "";
        $this->port = $_ENV['DB_PORT'] ?? "5432";
    }

    public function getConnection() {
        $this->conn = null;
        try {
            // Updated for Supabase (PostgreSQL)
            $dsn = "pgsql:host=" . $this->host . ";port=" . $this->port . ";dbname=" . $this->db_name;
            $this->conn = new PDO($dsn, $this->username, $this->password);
            $this->conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        } catch(PDOException $exception) {
            http_response_code(500);
            echo json_encode(["message" => "Connection error: " . $exception->getMessage()]);
            exit();
        }
        return $this->conn;
    }
}
?>
