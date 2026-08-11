/**
 * An empty stand-in for native-only packages.
 *
 * The verification scripts import store modules for their pure logic; those
 * modules reach UI packages (SVG, gradients, pickers) whose entry points assume
 * a React Native bundler. Nothing under test touches them.
 */
module.exports = new Proxy(
  {},
  {
    get: () => () => null,
  },
);
