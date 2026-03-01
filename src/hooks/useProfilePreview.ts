import { useState, useCallback } from 'react';
import { TimelinePost } from '../types/bluesky';

interface ProfilePreviewState {
  visible: boolean;
  author: TimelinePost['author'] | null;
}

const INITIAL_STATE: ProfilePreviewState = { visible: false, author: null };

export function useProfilePreview() {
  const [profilePreview, setProfilePreview] = useState<ProfilePreviewState>(INITIAL_STATE);

  const handleAvatarPress = useCallback((author: TimelinePost['author']) => {
    setProfilePreview({ visible: true, author });
  }, []);

  const closePreview = useCallback(() => {
    setProfilePreview((prev) => ({ ...prev, visible: false }));
  }, []);

  return { profilePreview, handleAvatarPress, closePreview };
}
