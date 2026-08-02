# Instrukcja Wdrożenia na GitHub Pages + Mikr.us 🌐
-------------------------------------------------

To wdrożenie rozdziela aplikację na dwie części:
1. **Mikr.us (Backend API)** – Służy wyłącznie jako baza danych SQLite i lekki skrypt zbierający oraz analizujący pakiety w Pythonie (pobiera bardzo mało RAM-u, ok. 15-20MB łącznie).
2. **GitHub Pages (Frontend)** – Serwuje Twoją stronę internetową z darmowego i szybkiego globalnego CDN od GitHuba (0% obciążenia dla Twojego Mikrusa!).

---

## Krok 1: Konfiguracja Mikr.usa (Backend API)

1. Połącz się ze swoim VPS-em przez SSH:
   ```bash
   ssh twój_login@twój_mikrus
   ```
2. Skopiuj pliki `collector.py` oraz `server.py` z katalogu `tools/mikrus/` na swój serwer do nowego katalogu (np. `~/mesh-api`).
3. Zainstaluj wymaganą bibliotekę:
   ```bash
   pip install paho-mqtt
   ```
4. Uruchom kolektor MQTT w tle, aby zbierał pakiety do pliku bazy SQLite `mesh.db`:
   ```bash
   MQTT_BROKER="meshcorekrk.cma.pl" MQTT_PORT=1883 python3 collector.py > collector.log 2>&1 &
   ```
5. Uruchom serwer API z włączoną obsługą CORS (umożliwi to pobieranie danych przez Twoją stronę na GitHubie):
   ```bash
   PORT=8080 CORS_ORIGIN="*" python3 server.py > server.log 2>&1 &
   ```

---

## Krok 2: Konfiguracja Bezpiecznej Subdomeny HTTPS na Mikr.usie

Ponieważ GitHub Pages wymusza bezpieczny protokół **HTTPS**, przeglądarka zablokuje pobieranie danych ze zwykłego adresu `http://`. Musisz podpiąć pod port `8080` bezpieczną subdomenę.

1. Wejdź na panel zarządzania swoim Mikrusem (lub na bota Mikrusa).
2. Wybierz usługę **szybka_subdomena** (np. `tojest.dev`).
3. Skonfiguruj następujące parametry:
   - **Wybrana subdomena:** wpisz swoją unikalną nazwę, np. `mojasiatka`
   - **Numer portu:** `8080` (port, na którym uruchomiłeś `server.py`)
   - **Port źródłowy podaje dane szyfrowane w HTTPS:** zaznacz tę opcję (zostanie wygenerowany darmowy certyfikat SSL Let's Encrypt).
4. Zapisz ustawienia. Twój Mikr.us będzie teraz dostępny bezpiecznie pod adresem:
   `https://mojasiatka.tojest.dev/data.json`

---

## Krok 3: Publikacja na GitHub Pages (Frontend)

1. Zaloguj się na swoje konto na GitHubie i stwórz nowe publiczne lub prywatne repozytorium (np. o nazwie `mesh-grid`).
2. Skopiuj plik `index.html` z katalogu `tools/mikrus/github-pages/` i zmodyfikuj w nim stałą konfiguracji (linia ~190):
   ```javascript
   const API_URL = "https://mojasiatka.tojest.dev/data.json"; // Wpisz swój adres z Kroku 2!
   ```
3. Prześlij zmodyfikowany plik `index.html` do swojego nowo stworzonego repozytorium na GitHubie.
4. Wejdź w **Settings** (Ustawienia) swojego repozytorium na GitHubie -> **Pages** (w menu po lewej stronie).
5. Pod nagłówkiem **Build and deployment**:
   - **Source:** Wybierz `Deploy from a branch`.
   - **Branch:** Wybierz `main` (lub `master`) i katalog `/ (root)`.
6. Kliknij **Save**.

Po około minucie Twoja strona będzie gotowa i w pełni bezpiecznie opublikowana pod darmowym, szyfrowanym adresem:
`https://twojanazwa.github.io/mesh-grid/`

Wszyscy odwiedzający będą pobierać szybki frontend bezpośrednio z serwerów GitHuba, a dane o topologii i regionach będą dynamicznie (i bezpiecznie przez CORS) doczytywane z Twojego VPS na Mikr.usie!
