<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\CompanyController;
use App\Http\Controllers\AdminController;

/*
|--------------------------------------------------------------------------
| Rotas da Aplicação
|--------------------------------------------------------------------------
|
| As rotas de API vêm primeiro (para não entrarem em conflito com as rotas
| do frontend). Depois, definimos as rotas web para o SPA (React/Vue)
| que inclui a rota /admin para o painel administrativo existente.
|
*/

// Rotas de autenticação da API
Route::prefix('api/auth')->group(function () {
    Route::post('/register', [AuthController::class, 'register']);
    Route::post('/login', [AuthController::class, 'login']);
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/user', [AuthController::class, 'user']);
});

// Rotas principais da API (com autenticação Sanctum)
Route::prefix('api')->middleware('auth:sanctum')->group(function () {
    // Dashboard
    Route::get('/dashboard/transactions', [DashboardController::class, 'transactions']);
    Route::get('/dashboard/wallet', [DashboardController::class, 'wallet']);

    // Perfil da empresa
    Route::get('/company/profile', [CompanyController::class, 'show']);
    Route::post('/company/profile', [CompanyController::class, 'store']);
    Route::patch('/company/profile', [CompanyController::class, 'update']);

    // Rotas administrativas (API)
    Route::prefix('admin')->middleware('admin')->group(function () {
        Route::get('/profiles/pending', [AdminController::class, 'pendingProfiles']);
        Route::patch('/profiles/{id}/approve', [AdminController::class, 'approveProfile']);
        Route::patch('/profiles/{id}/reject', [AdminController::class, 'rejectProfile']);
        Route::get('/transactions', [AdminController::class, 'allTransactions']);
        Route::get('/statistics', [AdminController::class, 'statistics']);
    });
});

/*
|--------------------------------------------------------------------------
| Rotas do Frontend (SPA)
|--------------------------------------------------------------------------
|
| Essas rotas fazem o Laravel entregar o layout principal (welcome.blade.php)
| para o frontend (React, Vue, etc.), incluindo a área /admin.
| Assim, o painel admin existente não quebra e não gera erro 404.
|
*/

// Página inicial
Route::view('/', 'welcome')->name('home');

// Painel administrativo (SPA já tem o layout)
Route::view('/admin/{any?}', 'welcome')->where('any', '.*');

// Outras rotas do frontend SPA
Route::view('/{any}', 'welcome')->where('any', '.*');
