# TODO

## V-UNION Cards
V-UNION cards (e.g., Pikachu V-UNION) are 4 physical cards that combine into one Pokemon. TCGdex returns identical stats/attacks for all 4 pieces — only the artwork differs (each is a quadrant). Currently filtered out in card-store.ts during set loading. To support them properly, we'd need to collapse the 4 pieces into one logical card and display the 4 art pieces as a grid. 16 cards total (Pikachu, Greninja, Mewtwo, Zacian). Low priority — not legal in standard/expanded.
