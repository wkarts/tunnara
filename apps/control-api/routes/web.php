<?php
use Illuminate\Support\Facades\Route;
Route::get('/', fn()=>response()->json(['service'=>'tunnara-control-api','version'=>config('app.version')]));
