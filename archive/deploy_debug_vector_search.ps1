# PowerShell script to deploy the enhanced vector search function with debug logging
# Run this in the project root directory

Write-Host "🚀 Deploying enhanced vector search function..." -ForegroundColor Blue

try {
    # Check if we're in the right directory
    if (!(Test-Path "supabase/functions")) {
        Write-Host "❌ Error: supabase/functions directory not found" -ForegroundColor Red
        Write-Host "Make sure you're running this from the project root directory" -ForegroundColor Yellow
        exit 1
    }

    # Deploy the chat function (which includes vector_search.ts)
    Write-Host "📤 Deploying chat function with enhanced logging..." -ForegroundColor Green
    
    supabase functions deploy chat --project-ref txhscptzjrrudnqwavcb
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Successfully deployed enhanced vector search function!" -ForegroundColor Green
        Write-Host "" 
        Write-Host "🔍 NEXT STEPS:" -ForegroundColor Cyan
        Write-Host "1. Open your agent chat page" -ForegroundColor White
        Write-Host "2. Send a message asking about your uploaded document" -ForegroundColor White
        Write-Host "3. Check the Supabase Functions logs for detailed debug output:" -ForegroundColor White
        Write-Host "   - Go to Supabase Dashboard > Functions > chat" -ForegroundColor Gray
        Write-Host "   - View the Invocations tab for logs" -ForegroundColor Gray
        Write-Host "4. Look for [DEBUG] log entries to see what's happening" -ForegroundColor White
        Write-Host ""
        Write-Host "🔧 DEBUGGING OPTIONS:" -ForegroundColor Cyan  
        Write-Host "• Run debug_agent_knowledge.js in browser console" -ForegroundColor White
        Write-Host "• Check debug_agent_documents.sql in Supabase SQL Editor" -ForegroundColor White
        Write-Host ""
    } else {
        Write-Host "❌ Deployment failed!" -ForegroundColor Red
        Write-Host "Check the error message above for details" -ForegroundColor Yellow
    }
    
} catch {
    Write-Host "❌ Deployment error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "Press any key to continue..." -ForegroundColor Yellow
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")