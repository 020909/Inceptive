import { driver } from "driver.js";

export type InceptiveTourId = "product-intro";

const baseConfig = {
  animate: true,
  overlayOpacity: 0.65,
  allowClose: true,
  showProgress: true,
  nextBtnText: "Next",
  prevBtnText: "Back",
  doneBtnText: "Done",
};

export function startTour(id: InceptiveTourId) {
  if (typeof window === "undefined") return;

  if (id === "product-intro") {
    const d = driver({
      ...baseConfig,
      steps: [
        {
          element: '[data-tour="sidebar"]',
          popover: {
            title: "Navigation",
            description:
              "Your workspace is organized by modules. Start with Dashboard, then jump into UBO/KYB, AML triage, or the Approval Queue.",
            side: "right",
            align: "start",
          },
        },
        {
          element: '[data-tour="nav-dashboard"]',
          popover: {
            title: "Dashboard",
            description: "A high-signal overview of queue + audit activity.",
            side: "right",
            align: "start",
          },
        },
        {
          element: '[data-tour="nav-ubo"]',
          popover: {
            title: "Run your first workflow",
            description:
              "Start here to upload documents and extract entities + ownership structure.",
            side: "right",
            align: "start",
          },
        },
        {
          element: '[data-tour="nav-cases"]',
          popover: {
            title: "Case Manager",
            description:
              "Create and track cases (KYB / SAR / AML). This is the core operational loop.",
            side: "right",
            align: "start",
          },
        },
        {
          element: '[data-tour="command-palette"]',
          popover: {
            title: "Command palette",
            description:
              "Press ⌘K (or click here) to search and navigate instantly.",
            side: "bottom",
            align: "start",
          },
        },
        {
          element: '[data-tour="help-menu"]',
          popover: {
            title: "Help & onboarding",
            description:
              "Re-run the tour anytime, open connectors, or jump into cases.",
            side: "bottom",
            align: "end",
          },
        },
        {
          element: '[data-tour="sidebar-toggle"]',
          popover: {
            title: "Compact mode",
            description:
              "Collapse the sidebar to focus on work. You can always expand it back.",
            side: "bottom",
            align: "start",
          },
        },
        {
          element: '[data-tour="account-menu"]',
          popover: {
            title: "Account & settings",
            description:
              "Manage your account, credits, and preferences from here.",
            side: "top",
            align: "start",
          },
        },
      ],
      onDestroyed: () => {
        // Cleanup: remove the query param if it was used to trigger.
        try {
          const url = new URL(window.location.href);
          url.searchParams.delete("welcome");
          window.history.replaceState({}, "", url.toString());
        } catch {
          // ignore
        }
      },
    });

    d.drive();
  }
}

