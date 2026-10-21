// Which sponsored cards and affiliate books to show where. Pure, tested.
import type { Category } from './constants';
import type { Book, SponsoredCard } from './types';

const live = (from: string | null | undefined, to: string | null | undefined, today: string) =>
  (!from || from.slice(0, 10) <= today) && (!to || to.slice(0, 10) >= today);

/** Active sponsored cards for a page about this category and/or state (empty targeting = everywhere). */
export function sponsoredFor(cards: SponsoredCard[], where: { category?: Category | null; state?: string | null }, today: string): SponsoredCard[] {
  return cards.filter(
    (c) =>
      c.active &&
      live(c.startDate, c.endDate, today) &&
      (!c.categories?.length || (where.category != null && c.categories.includes(where.category))) &&
      (!c.states?.length || (where.state != null && c.states.includes(where.state))),
  );
}

/** Books for a job: keyword matches in the title first, then same-category books. */
export function booksFor(books: Book[], job: { title: string; category: Category }, max = 3): Book[] {
  const title = job.title.toLowerCase();
  const active = books.filter((b) => b.active);
  const byKeyword = active.filter((b) => b.keywords?.some((k) => k.trim() && title.includes(k.trim().toLowerCase())));
  const byCategory = active.filter((b) => !byKeyword.includes(b) && b.categories?.includes(job.category));
  return [...byKeyword, ...byCategory].slice(0, max);
}
