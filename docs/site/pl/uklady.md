# Ranking układów

Od najniższego do najwyższego. Kolejność kategorii jest ustawieniem gry, poniżej wartość domyślna.

| #   | Układ        | Parametry                | Występuje, gdy w puli jest                       |
| --- | ------------ | ------------------------ | ------------------------------------------------ |
| 1   | Wysoka karta | figura                   | co najmniej 1 karta tej figury                   |
| 2   | Para         | figura                   | co najmniej 2 karty tej figury                   |
| 3   | Dwie pary    | dwie figury              | co najmniej 2 karty każdej z nich                |
| 4   | Strit        | najwyższa figura         | co najmniej po 1 karcie z pięciu kolejnych figur |
| 5   | Trójka       | figura                   | co najmniej 3 karty tej figury                   |
| 6   | Kolor        | tylko kolor              | co najmniej 5 kart tego koloru                   |
| 7   | Full         | trójka i para            | 3 karty jednej figury i 2 drugiej                |
| 8   | Kareta       | figura                   | 4 karty tej figury                               |
| 9   | Poker        | najwyższa figura i kolor | pięć kolejnych figur, wszystkie w tym kolorze    |

Strit jest **poniżej** trójki (odwrotnie niż w klasycznym pokerze), bo przy kartach wielu graczy strit występuje łatwiej. As jest zawsze najwyższą kartą, a A-2-3-4-5 nie jest stritem.

W obrębie kategorii najpierw rozstrzyga parametr główny, potem poboczny. W dwóch parach najpierw wyższa para, w fullu najpierw trójka. Kolory: trefl < karo < kier < pik. Najwyższa możliwa deklaracja to poker do asa w piku.
