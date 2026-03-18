import { useCallback, useState } from "react";

export function useSectionNavigation() {
  const [resourceCollapsed, setResourceCollapsed] = useState(true);
  const [challengeCollapsed, setChallengeCollapsed] = useState(true);
  const [forumCollapsed, setForumCollapsed] = useState(true);

  const scrollToSection = useCallback((id: string) => {
    if (typeof document === "undefined") return;
    const section = document.getElementById(id);
    if (!section) return;
    section.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const goToResource = useCallback(() => {
    setResourceCollapsed(false);
    requestAnimationFrame(() => scrollToSection("day-resource"));
  }, [scrollToSection]);

  const goToChallenge = useCallback(() => {
    setChallengeCollapsed(false);
    requestAnimationFrame(() => scrollToSection("day-challenge"));
  }, [scrollToSection]);

  const goToForum = useCallback(() => {
    setForumCollapsed(false);
    requestAnimationFrame(() => scrollToSection("day-forum"));
  }, [scrollToSection]);

  return {
    resourceCollapsed, setResourceCollapsed,
    challengeCollapsed, setChallengeCollapsed,
    forumCollapsed, setForumCollapsed,
    goToResource,
    goToChallenge,
    goToForum,
  };
}
