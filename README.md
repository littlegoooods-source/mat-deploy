# Workshop Management — Docker Compose Deploy

Docker Compose конфигурация для развёртывания Workshop Management System на **Timeweb Cloud App Platform**.

## Архитектура

```
┌─────────────────────────────────────────────┐
│              Timeweb Cloud Server            │
│                                              │
│  ┌──────────────────────┐  ┌──────────────┐ │
│  │     Frontend (nginx) │  │   Backend    │ │
│  │    port 9000 → 80    │  │  port 8080   │ │
│  │                      │  │  ASP.NET 8   │ │
│  │  /        → SPA      │  │              │ │
│  │  /api/*   → proxy ───┼──┤► /api/*      │ │
│  │  /swagger → proxy ───┼──┤► /swagger    │ │
│  └──────────────────────┘  └──────┬───────┘ │
│                                    │         │
└────────────────────────────────────┼─────────┘
                                     │
                          ┌──────────▼──────────┐
                          │    PostgreSQL DB     │
                          │  (Timeweb DBaaS /    │
                          │   external service)  │
                          └─────────────────────┘
```

- **Frontend** — React + Vite, раздаётся через nginx. Nginx также проксирует `/api/*` запросы на backend.
- **Backend** — ASP.NET Core 8, REST API на порту 8080.
- **PostgreSQL** — внешняя база данных (Timeweb Cloud DBaaS, Render, Supabase и т.д.).

> **Мобильное приложение** (Kotlin/Android) не разворачивается через Docker. После деплоя backend укажите его URL в настройках мобильного приложения.

## Развёртывание на Timeweb Cloud

### Шаг 1. Подготовка базы данных

Создайте PostgreSQL базу данных. Варианты:

- **Timeweb Cloud DBaaS** — рекомендуется, [документация](https://timeweb.cloud/docs/dbaas/postgresql)
- **Render.com** — можно использовать вашу текущую БД
- **Supabase / Neon** — бесплатные managed PostgreSQL

Запишите строку подключения в формате:
```
postgres://user:password@host:5432/dbname
```

### Шаг 2. Загрузка репозитория на GitHub

1. Создайте новый репозиторий на GitHub (например, `mat-deploy`)
2. Загрузите содержимое этой папки:

```bash
git add .
git commit -m "Initial deploy configuration"
git remote add origin https://github.com/YOUR_USERNAME/mat-deploy.git
git push -u origin main
```

### Шаг 3. Создание приложения в Timeweb Cloud

1. Перейдите в [Timeweb Cloud](https://timeweb.cloud/my/apps/create)
2. **Тип** → вкладка Docker → **Docker Compose**
3. **Репозиторий** → подключите ваш GitHub аккаунт и выберите `mat-deploy`
4. **Ветка** → `main`, включите "Сборка по последнему коммиту"
5. **Регион и конфигурация** → выберите подходящий тариф (рекомендуется от 2 vCPU / 2 GB RAM)

### Шаг 4. Настройка переменных окружения

В разделе "Переменные окружения" добавьте:

| Переменная       | Значение                                      | Обязательно |
|------------------|-----------------------------------------------|-------------|
| `DATABASE_URL`   | `postgres://user:password@host:5432/dbname`   | Да          |
| `JWT_SECRET`     | Случайная строка (мин. 32 символа)            | Да          |
| `ALLOWED_ORIGINS`| `*` (или URL вашего фронтенда)                | Нет         |

### Шаг 5. Запуск деплоя

Нажмите **"Запустить деплой"**. После завершения:

- Приложение будет доступно по техническому домену Timeweb Cloud
- Frontend (первый сервис) проксируется на основной домен
- Backend доступен на порту 8080 того же домена

### Шаг 6. Проверка

- Откройте `https://ваш-домен.timeweb.cloud` — должен загрузиться frontend
- Откройте `https://ваш-домен.timeweb.cloud/swagger` — Swagger UI бэкенда
- Откройте `https://ваш-домен.timeweb.cloud/health` — статус backend

## Привязка собственного домена

После деплоя можно привязать свой домен через [инструкцию Timeweb Cloud](https://timeweb.cloud/docs/apps/upravlenie-apps-v-paneli#privyazka-domena).

## Настройка мобильного приложения

После деплоя укажите в мобильном приложении URL бэкенда:
```
https://ваш-домен.timeweb.cloud
```
API будет доступен по пути `/api/*` через nginx-прокси основного домена, либо напрямую по `http://ваш-домен.timeweb.cloud:8080/api/*`.

## Локальный запуск (для тестирования)

```bash
# Скопируйте и настройте переменные
cp .env.example .env
# Отредактируйте .env — укажите DATABASE_URL

# Запуск
docker compose up --build

# Frontend: http://localhost:9000
# Backend API: http://localhost:8080/api
# Swagger: http://localhost:9000/swagger
```

## Структура файлов

| Файл                  | Описание                                              |
|-----------------------|-------------------------------------------------------|
| `docker-compose.yml`  | Конфигурация сервисов                                 |
| `frontend.Dockerfile` | Сборка React-приложения + nginx с API proxy           |
| `backend.Dockerfile`  | Сборка ASP.NET Core бэкенда                           |
| `nginx/default.conf`  | Конфигурация nginx: SPA routing + API проксирование   |
| `.env.example`        | Шаблон переменных окружения                           |
