# Ultra-Lekki Analizator Topologii Mesh dla Mikr.us 🚀
--------------------------------------------------

Ten katalog zawiera w pełni niezależny, super-lekki i zoptymalizowany pod kątem Mikr.usa analizator siatki MeshCore.
Zaprojektowany specjalnie z myślą o minimalnym zużyciu pamięci RAM (<15MB) oraz CPU, idealnie pasuje do maszyn o ograniczonych zasobach (np. Mikrus 2.1).

## Jak to działa?
1. **collector.py** – Lekki demon w tle, który nasłuchuje na wskazanym porcie MQTT, odbiera pakiety i błyskawicznie zapisuje je jako "raw" do SQLite (`mesh.db`). Zużycie RAM: ok. 10MB.
2. **server.py** – Mikro-serwer HTTP podający plik wizualizacji (`index.html`) oraz generujący na żądanie analizę topologiczną (`data.json`) z bazy SQLite w czasie rzeczywistym. Zużycie RAM: ok. 12MB.
3. **index.html** – Całkowicie statyczna strona internetowa z interaktywnym Canvasem, która rysuje topologię sieci, nakłada regiony (bańki scope), rysuje grubość połączeń oraz obsługuje przybliżanie/panoramowanie bezpośrednio w Twojej przeglądarce.

---

## 🛠️ Instalacja i Uruchomienie na Mikr.usie (W 2 minuty)

### Krok 1: Kopiowanie plików na VPS
Skopiuj cały katalog `tools/mikrus` na swój serwer Mikr.us (np. za pomocą `scp` lub git).

### Krok 2: Instalacja prostej zależności MQTT
Upewnij się, że masz zainstalowaną bibliotekę `paho-mqtt`:
```bash
pip install paho-mqtt
```

### Krok 3: Uruchomienie kolektora pakietów MQTT w tle
Uruchom kolektor podając konfigurację MQTT. Jeśli Twój MQTT wymaga loginu i hasła, podaj je w zmiennych środowiskowych:

```bash
MQTT_BROKER="meshcorekrk.cma.pl" MQTT_PORT=1883 python3 collector.py > collector.log 2>&1 &
```
*Kolektor zacznie zbierać dane do pliku bazy `mesh.db`.*

### Krok 4: Uruchomienie serwera WWW
Możesz uruchomić serwer na wolnym porcie Mikr.usa (np. 8080):
```bash
PORT=8080 python3 server.py > server.log 2>&1 &
```

Teraz możesz podpiąć tę aplikację pod **Cytr.usa** lub skorzystać z usługi **szybka_subdomena** na Mikr.usie (np. przekierowując subdomenę `twojanazwa.tojest.dev` na port `8080`).

---

## 🌍 Języki i Interakcja
- Strona automatycznie wspiera tryb **ciemny** i dwa języki: **Polski / Angielski** (przycisk w nagłówku).
- Pozwala na przełączanie trybu wizualizacji: **Oparty o regiony (bańki scope)** oraz **Czysto sąsiedzki (topologia)**.
- Kliknięcie na dowolny węzeł natychmiast wysuwa szczegółowe informacje z rozkładem skoków (hopów) oraz scope'ów pakietów.
