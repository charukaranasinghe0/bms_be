$reg = Invoke-RestMethod -Method Post -Uri "http://localhost:4000/api/auth/register" -ContentType "application/json" -Body '{"username":"user1","password":"password123"}'
$reg.accessToken

$login = Invoke-RestMethod -Method Post -Uri "http://localhost:4000/api/auth/login" -ContentType "application/json" -Body '{"username":"admin","password":"admin123"}'
$token = $login.accessToken
$token

Invoke-RestMethod -Method Get -Uri "http://localhost:4000/api/auth/me" -Headers @{ Authorization = "Bearer $token" }

Invoke-RestMethod -Method Get -Uri "http://localhost:4000/api/users/me" -Headers @{ Authorization = "Bearer $token" }

Invoke-RestMethod -Method Get -Uri "http://localhost:4000/api/users" -Headers @{ Authorization = "Bearer $token" }

