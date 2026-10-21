// Renders <script type="application/ld+json"> into the pre-rendered HTML.
export function JsonLd({ data }: { data: object | null | (object | null)[] }) {
  const items = (Array.isArray(data) ? data : [data]).filter(Boolean);
  if (!items.length) return null;
  // Escape "<" so job text can never close the script tag.
  const json = JSON.stringify(items.length === 1 ? items[0] : items).replace(/</g, '\\u003c');
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
