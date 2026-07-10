import dishesData from "@/data/dishes.json";

export interface Dish {
  id: string;
  name: string;
  cuisine: string;
  description: string;
  unsplash_search: string;
  zomato_search: string;
}

export const dishes: Dish[] = dishesData as Dish[];

const dishById = new Map(dishes.map((dish) => [dish.id, dish]));

export function getDishById(id: string): Dish | undefined {
  return dishById.get(id);
}

export function shuffleDishIds(): string[] {
  const ids = dishes.map((dish) => dish.id);
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  return ids;
}
