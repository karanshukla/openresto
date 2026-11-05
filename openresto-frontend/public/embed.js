/*
 * OpenResto booking widget loader (issue #513). A restaurant's own site includes
 *
 *   <script src="https://<instance>/embed.js" data-location="3"></script>
 *
 * and this replaces the tag with an iframe of <instance>/embed, sized to its content. The
 * widget page posts its height (utils/embedHeight.ts); only messages from the instance's own
 * origin and from this iframe are trusted.
 */
(function () {
  const script = document.currentScript;
  if (!script) return;

  const origin = new URL(script.src).origin;
  const src = new URL("/embed", origin);
  const location = script.getAttribute("data-location");
  if (location) src.searchParams.set("location", location);

  const frame = document.createElement("iframe");
  frame.src = src.toString();
  frame.title = "Book a table";
  frame.loading = "lazy";
  frame.style.cssText = "display:block;width:100%;max-width:560px;height:640px;border:0;";
  script.parentNode.insertBefore(frame, script.nextSibling);

  window.addEventListener("message", function (event) {
    if (event.origin !== origin || event.source !== frame.contentWindow) return;
    const data = event.data;
    if (data && data.type === "openresto:embed-height" && typeof data.height === "number") {
      frame.style.height = data.height + "px";
    }
  });
})();
