import type { NotificationAudience, NotificationRecord } from "./types";
import { storageKeys } from "./data";
import { createId, getStoredList, setStoredList } from "./storage";

export function getNotifications(): NotificationRecord[] {
  return getStoredList<NotificationRecord>(storageKeys.notifications);
}

export function createNotification(input: Omit<NotificationRecord, "id" | "createdAt">): NotificationRecord {
  const notification: NotificationRecord = {
    id: createId(),
    createdAt: new Date().toISOString(),
    ...input,
  };
  setStoredList(storageKeys.notifications, [notification, ...getNotifications()].slice(0, 100));
  return notification;
}

export function notifyMany(items: Array<Omit<NotificationRecord, "id" | "createdAt">>): NotificationRecord[] {
  return items.map(createNotification);
}

export function getNotificationsFor(audience: NotificationAudience, recipient?: string): NotificationRecord[] {
  return getNotifications().filter((notification) => {
    if (notification.audience !== audience) return false;
    return !notification.recipient || !recipient || notification.recipient === recipient;
  });
}

export function markNotificationRead(id: string): NotificationRecord | null {
  const notifications = getNotifications();
  const notification = notifications.find((item) => item.id === id);
  if (!notification) return null;
  notification.readAt = notification.readAt || new Date().toISOString();
  setStoredList(storageKeys.notifications, notifications);
  return notification;
}
