/**
 * InfoTip — hover tooltip with ℹ️ icon for contextual help.
 * Pure CSS tooltip, no external dependencies.
 */
export default function InfoTip({ text }) {
  return (
    <span className="infotip-wrap">
      <span className="infotip-icon">{'\u2139\uFE0F'}</span>
      <span className="infotip-bubble">{text}</span>
    </span>
  );
}
