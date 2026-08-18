import { createContext, useContext, useEffect, useState } from 'react';

/**
 * Page meta — lets a page hand its subtitle (and optional title override) to the
 * app header, so the page itself doesn't have to repeat the title the top bar
 * already shows.
 *
 * Usage inside a page:
 *   usePageMeta({ subtitle: `${members} members · ${skills} skills` });
 */
const PageMetaContext = createContext({ meta: {}, setMeta: () => {} });

export function PageMetaProvider({ children }) {
  const [meta, setMeta] = useState({});
  return (
    <PageMetaContext.Provider value={{ meta, setMeta }}>
      {children}
    </PageMetaContext.Provider>
  );
}

export function usePageMetaValue() {
  return useContext(PageMetaContext).meta;
}

export function usePageMeta({ title, subtitle } = {}) {
  const { setMeta } = useContext(PageMetaContext);
  useEffect(() => {
    setMeta({ title, subtitle });
    return () => setMeta({});
  }, [title, subtitle, setMeta]);
}
