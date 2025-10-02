# Script de verificación de credenciales AWS SES
# Para Windows PowerShell

Write-Host "🔍 Verificador de Credenciales AWS SES" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Cargar variables de entorno desde .env
if (Test-Path ".env") {
    Write-Host "✓ Archivo .env encontrado" -ForegroundColor Green
    
    $envContent = Get-Content ".env" -Raw
    
    # Extraer credenciales
    if ($envContent -match 'AWS_ACCESS_KEY_ID=(.+)') {
        $accessKey = $matches[1].Trim()
        Write-Host "`n📋 AWS_ACCESS_KEY_ID encontrada" -ForegroundColor Yellow
        Write-Host "   Longitud: $($accessKey.Length) caracteres" -ForegroundColor White
        Write-Host "   Primeros 4: $($accessKey.Substring(0,4))..." -ForegroundColor White
        Write-Host "   Últimos 4: ...$($accessKey.Substring($accessKey.Length-4))" -ForegroundColor White
        
        # Verificar espacios
        if ($accessKey -match '\s') {
            Write-Host "   ⚠️  ADVERTENCIA: Contiene espacios en blanco!" -ForegroundColor Red
        } else {
            Write-Host "   ✓ Sin espacios" -ForegroundColor Green
        }
    } else {
        Write-Host "❌ AWS_ACCESS_KEY_ID no encontrada" -ForegroundColor Red
    }
    
    if ($envContent -match 'AWS_SECRET_ACCESS_KEY=(.+)') {
        $secretKey = $matches[1].Trim()
        Write-Host "`n🔑 AWS_SECRET_ACCESS_KEY encontrada" -ForegroundColor Yellow
        Write-Host "   Longitud: $($secretKey.Length) caracteres" -ForegroundColor White
        Write-Host "   Primeros 4: $($secretKey.Substring(0,4))..." -ForegroundColor White
        Write-Host "   Últimos 4: ...$($secretKey.Substring($secretKey.Length-4))" -ForegroundColor White
        
        # Verificar espacios
        if ($secretKey -match '\s') {
            Write-Host "   ⚠️  ADVERTENCIA: Contiene espacios en blanco!" -ForegroundColor Red
        } else {
            Write-Host "   ✓ Sin espacios" -ForegroundColor Green
        }
        
        # Verificar saltos de línea
        if ($secretKey -match '[\r\n]') {
            Write-Host "   ⚠️  ADVERTENCIA: Contiene saltos de línea!" -ForegroundColor Red
        }
    } else {
        Write-Host "❌ AWS_SECRET_ACCESS_KEY no encontrada" -ForegroundColor Red
    }
    
    if ($envContent -match 'AWS_REGION=(.+)') {
        $region = $matches[1].Trim()
        Write-Host "`n🌎 AWS_REGION encontrada: $region" -ForegroundColor Yellow
    }
    
    if ($envContent -match 'AWS_SES_FROM_EMAIL=(.+)') {
        $fromEmail = $matches[1].Trim()
        Write-Host "📧 AWS_SES_FROM_EMAIL encontrada: $fromEmail" -ForegroundColor Yellow
    }
    
    # Recomendaciones
    Write-Host "`n📝 Recomendaciones:" -ForegroundColor Cyan
    Write-Host "==================" -ForegroundColor Cyan
    Write-Host "1. Verifica que las credenciales sean las correctas en AWS Console" -ForegroundColor White
    Write-Host "2. Asegúrate de que NO haya espacios antes o después de las claves" -ForegroundColor White
    Write-Host "3. Verifica que la región sea correcta (ej: us-east-1)" -ForegroundColor White
    Write-Host "4. Confirma que el email esté verificado en SES" -ForegroundColor White
    Write-Host "`n💡 Si copiaste las credenciales desde AWS Console:" -ForegroundColor Yellow
    Write-Host "   - Usa 'Show' para ver la clave completa" -ForegroundColor White
    Write-Host "   - Copia TODO el texto (sin espacios extra)" -ForegroundColor White
    Write-Host "   - Pega directamente después del '=' sin espacios" -ForegroundColor White
    
} else {
    Write-Host "❌ Archivo .env no encontrado" -ForegroundColor Red
    Write-Host "   Crea un archivo .env en la raíz del proyecto" -ForegroundColor Yellow
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Presiona cualquier tecla para continuar..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")