# Hand ranking

From the lowest to the highest hand. The order of categories is a game setting; this is the default.

| #   | Hand            | Parameters                  | It exists when the pool contains                    |
| --- | --------------- | --------------------------- | --------------------------------------------------- |
| 1   | High card       | a rank                      | at least 1 card of that rank                        |
| 2   | Pair            | a rank                      | at least 2 cards of that rank                       |
| 3   | Two pair        | two ranks                   | at least 2 cards of each                            |
| 4   | Straight        | the highest rank            | at least one card of each of five consecutive ranks |
| 5   | Three of a kind | a rank                      | at least 3 cards of that rank                       |
| 6   | Flush           | a suit only                 | at least 5 cards of that suit                       |
| 7   | Full house      | the three and the pair      | 3 cards of one rank and 2 of another                |
| 8   | Four of a kind  | a rank                      | 4 cards of that rank                                |
| 9   | Straight flush  | the highest rank and a suit | five consecutive ranks, all of that suit            |

A straight is **below** three of a kind (the reverse of classic poker), because with the cards of many players a straight is easier to find. The ace is always the highest card; A-2-3-4-5 is not a straight.

Within a category: the main parameter decides first, then the secondary one. For two pair the higher pair comes first; for a full house the three comes first. Suits are ordered clubs < diamonds < hearts < spades. The highest possible declaration is a straight flush to the ace of spades.
