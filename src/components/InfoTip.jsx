/**
 * InfoTip — hover tooltip with ℹ️ icon for contextual help.
 * Uses a portal + position:fixed so the bubble is never clipped
 * by parent overflow or hidden behind sticky headers.
 */
import { useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';

export default function InfoTip({ text }) {
  const [pos, setPos] = useState(null);
  const iconRef = useRef(null);

  const show = useCallback(() => {
    const rect = iconRef.current.getBoundingClientRect();
    setPos({ top: rect.top, left: rect.left + rect.width / 2 });
  }, []);

  const hide = useCallback(() => setPos(null), []);

  return (
    <span className="infotip-wrap" onMouseEnter={show} onMouseLeave={hide}>
      <span className="infotip-icon" ref={iconRef}>{'\u2139\uFE0F'}</span>
      {pos && createPortal(
        <span
          className="infotip-bubble"
          style={{ top: pos.top, left: pos.left }}
        >
          {text}
        </span>,
        document.body
      )}
    </span>
  );
}
