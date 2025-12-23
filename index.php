<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Yamaha 01V96 V2 Control</title>
    <link rel="stylesheet" href="public/style.css">
    <style>
        .server-info {
            background: rgba(255, 255, 255, 0.05);
            backdrop-filter: blur(10px);
            border-radius: 12px;
            padding: 20px;
            margin: 20px 0;
            border: 1px solid rgba(255, 255, 255, 0.1);
        }
        .server-info h3 {
            margin-top: 0;
            color: #667eea;
        }
        .server-info pre {
            background: rgba(0, 0, 0, 0.3);
            padding: 10px;
            border-radius: 5px;
            overflow-x: auto;
        }
        .btn-start {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border: none;
            color: white;
            padding: 15px 30px;
            font-size: 16px;
            font-weight: 600;
            border-radius: 8px;
            cursor: pointer;
            margin: 10px 0;
            transition: all 0.3s;
        }
        .btn-start:hover {
            transform: translateY(-2px);
            box-shadow: 0 10px 20px rgba(102, 126, 234, 0.3);
        }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>Yamaha 01V96 V2 Remote Control</h1>
            <div class="status">
                <span class="status-indicator" id="connectionStatus"></span>
                <span id="connectionText">Server Status</span>
            </div>
        </header>

        <main>
            <div class="server-info">
                <h3>Server Information</h3>
                <pre><?php
echo "PHP Version: " . phpversion() . "\n";
echo "Server: " . $_SERVER['SERVER_SOFTWARE'] . "\n";
echo "Document Root: " . $_SERVER['DOCUMENT_ROOT'] . "\n";
echo "Host: " . $_SERVER['HTTP_HOST'] . "\n";

// Database connection check
try {
    $db_host = getenv('DB_HOST') ?: 'db';
    $db_name = getenv('DB_DATABASE') ?: 'yamaha_mixer';
    $db_user = getenv('DB_USERNAME') ?: 'yamaha_user';
    $db_pass = getenv('DB_PASSWORD') ?: 'yamaha_pass';

    $pdo = new PDO("mysql:host=$db_host;dbname=$db_name", $db_user, $db_pass);
    echo "Database: Connected to $db_name\n";

    // Check tables
    $stmt = $pdo->query("SHOW TABLES");
    $tables = $stmt->fetchAll(PDO::FETCH_COLUMN);
    echo "Tables: " . implode(', ', $tables) . "\n";

} catch (PDOException $e) {
    echo "Database: Connection failed - " . $e->getMessage() . "\n";
}
?></pre>
            </div>

            <div class="server-info">
                <h3>MIDI Control</h3>
                <p>Der MIDI-Server läuft als separate Node.js Anwendung.</p>
                <p>Um den MIDI WebSocket Server zu starten, führe aus:</p>
                <pre>node server.js</pre>
                <button class="btn-start" onclick="startMidiServer()">MIDI Server starten</button>
                <div id="serverOutput" style="margin-top: 10px;"></div>
            </div>

            <div class="server-info">
                <h3>Quick Links</h3>
                <ul>
                    <li><a href="public/index.html" style="color: #667eea;">Web Control Interface</a></li>
                    <li><a href="api.php" style="color: #667eea;">API Endpoints</a></li>
                    <li><a href="scenes.php" style="color: #667eea;">Scene Management</a></li>
                </ul>
            </div>
        </main>

        <footer>
            <div class="info">
                <p>Yamaha 01V96 V2 Web Control System</p>
                <p>Running in Docker Container | PHP <?php echo phpversion(); ?> | MySQL</p>
            </div>
        </footer>
    </div>

    <script>
        function startMidiServer() {
            const output = document.getElementById('serverOutput');
            output.innerHTML = '<p style="color: #ffaa00;">Starte MIDI Server...</p>';

            // In production, this would call a PHP endpoint that starts the server
            fetch('start_server.php')
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        output.innerHTML = '<p style="color: #44ff44;">✓ Server gestartet!</p>';
                        setTimeout(() => {
                            window.location.href = 'public/index.html';
                        }, 1000);
                    } else {
                        output.innerHTML = '<p style="color: #ff4444;">✗ Fehler: ' + data.error + '</p>';
                    }
                })
                .catch(error => {
                    output.innerHTML = '<p style="color: #ff4444;">✗ Fehler: ' + error.message + '</p>';
                });
        }

        // Check server status
        setInterval(() => {
            fetch('status.php')
                .then(response => response.json())
                .then(data => {
                    const indicator = document.getElementById('connectionStatus');
                    const text = document.getElementById('connectionText');

                    if (data.midi_server_running) {
                        indicator.classList.add('connected');
                        text.textContent = 'MIDI Server Running';
                    } else {
                        indicator.classList.remove('connected');
                        text.textContent = 'MIDI Server Offline';
                    }
                })
                .catch(error => {
                    console.error('Status check failed:', error);
                });
        }, 3000);
    </script>
</body>
</html>
