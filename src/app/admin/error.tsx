"use client";

// Same friendly error (with developer details in development) as the customer app, so an
// admin page failure never falls through to the root and re-renders the whole document.
export { default } from "../(app)/error";
