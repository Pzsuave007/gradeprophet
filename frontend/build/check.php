<?php
header('Content-Type: text/plain');
echo "=== VERIFICADOR FLIPSLAB ===\n\n";

$web = "/home/flipcardsuni2/public_html";
$repo = "/home/gradeprophet/frontend/build";

// 1. Que hay en public_html ahora?
echo "1. INDEX.HTML ACTUAL:\n";
$html = file_get_contents("$web/index.html");
preg_match('/main\.[a-f0-9]+\.js/', $html, $m);
echo "   JS: " . ($m[0] ?? "NO ENCONTRADO") . "\n\n";

// 2. Que JS files existen?
echo "2. JS FILES EN public_html:\n";
$jsfiles = glob("$web/static/js/main.*.js");
foreach ($jsfiles as $f) {
    echo "   " . basename($f) . " (" . filesize($f) . " bytes)\n";
}
if (empty($jsfiles)) echo "   NINGUNO!\n";
echo "\n";

// 3. Que hay en el repo?
echo "3. REPO frontend/build:\n";
if (is_dir($repo)) {
    $repohtml = file_get_contents("$repo/index.html");
    preg_match('/main\.[a-f0-9]+\.js/', $repohtml, $m2);
    echo "   index.html JS: " . ($m2[0] ?? "NO ENCONTRADO") . "\n";
    $repojs = glob("$repo/static/js/main.*.js");
    foreach ($repojs as $f) {
        echo "   " . basename($f) . " (" . filesize($f) . " bytes)\n";
    }
    if (empty($repojs)) echo "   NO HAY JS FILES EN REPO!\n";
} else {
    echo "   DIRECTORIO NO EXISTE: $repo\n";
}
echo "\n";

// 4. Intentar copiar
echo "4. COPIANDO ARCHIVOS...\n";
if (is_dir($repo)) {
    // Copy index.html
    $ok1 = copy("$repo/index.html", "$web/index.html");
    echo "   index.html: " . ($ok1 ? "OK" : "FALLO") . "\n";
    
    // Copy JS
    @mkdir("$web/static/js", 0755, true);
    foreach (glob("$web/static/js/main.*.js") as $old) { unlink($old); }
    foreach (glob("$repo/static/js/main.*.js") as $f) {
        $dest = "$web/static/js/" . basename($f);
        $ok = copy($f, $dest);
        echo "   " . basename($f) . ": " . ($ok ? "OK (" . filesize($dest) . " bytes)" : "FALLO") . "\n";
    }
    
    // Copy CSS
    @mkdir("$web/static/css", 0755, true);
    foreach (glob("$web/static/css/main.*.css") as $old) { unlink($old); }
    foreach (glob("$repo/static/css/main.*.css") as $f) {
        $dest = "$web/static/css/" . basename($f);
        $ok = copy($f, $dest);
        echo "   " . basename($f) . ": " . ($ok ? "OK" : "FALLO") . "\n";
    }
} else {
    echo "   NO SE PUEDE COPIAR - repo no existe\n";
}

echo "\n5. VERIFICACION FINAL:\n";
$html2 = file_get_contents("$web/index.html");
preg_match('/main\.[a-f0-9]+\.js/', $html2, $m3);
echo "   JS ahora: " . ($m3[0] ?? "???") . "\n";
$newjs = glob("$web/static/js/main.*.js");
foreach ($newjs as $f) {
    echo "   Existe: " . basename($f) . " (" . filesize($f) . " bytes)\n";
}

echo "\n=== BORRA ESTE ARCHIVO DESPUES: rm $web/check.php ===\n";
?>
