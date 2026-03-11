'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * Portals provide a first-class way to render children into a DOM node 
 * that exists outside the DOM hierarchy of the parent component.
 * 
 * Used here to break modals out of stacking contexts (like #page-scroller)
 * and ensure they render at the end of <body>.
 */
export function Portal({ children }: { children: React.ReactNode }) {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    // Only render on the client to avoid hydration mismatch with document.body
    if (!mounted) return null;

    return createPortal(children, document.body);
}
