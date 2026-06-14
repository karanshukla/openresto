const React = require("react");
function AnimatedAccordion({ expanded, children }) {
  return expanded ? children : null;
}
module.exports = { AnimatedAccordion };
