import { useCallback, useEffect, useMemo, useState } from "react";

export function useForumParticipation(labId: string, dayNumber: number) {
  const forumCommentMarkerKey = useMemo(
    () => `astrolab_forum_commented_${labId}_${dayNumber}`,
    [dayNumber, labId],
  );

  const [hasUserForumComment, setHasUserForumComment] = useState(false);
  const [forumMarkerLoaded, setForumMarkerLoaded] = useState(false);

  useEffect(() => {
    setHasUserForumComment(false);
    setForumMarkerLoaded(false);
  }, [labId, dayNumber]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setHasUserForumComment(window.localStorage.getItem(forumCommentMarkerKey) === "1");
    setForumMarkerLoaded(true);
  }, [forumCommentMarkerKey]);

  const handleForumActivityChange = useCallback(
    ({ hasUserComment }: { commentCount: number; hasUserComment: boolean }) => {
      setHasUserForumComment(hasUserComment);
      if (typeof window !== "undefined") {
        if (hasUserComment) {
          window.localStorage.setItem(forumCommentMarkerKey, "1");
        } else {
          window.localStorage.removeItem(forumCommentMarkerKey);
        }
      }
    },
    [forumCommentMarkerKey],
  );

  return { hasUserForumComment, forumMarkerLoaded, handleForumActivityChange };
}
