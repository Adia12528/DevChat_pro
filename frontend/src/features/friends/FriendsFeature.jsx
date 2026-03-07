      // Forward message handler
      const handleForwardMessage = async (targetUniqueId) => {
        if (!socket || !forwardMsg || !targetUniqueId) return;
        const tempId = makeTempMessageId();
        const policy = { mode: 'keep' };
        const optimisticMessage = {
          id: tempId,
          text: forwardMsg.text,
          createdAt: new Date().toISOString(),
          expiresAt: null,
          disappearPolicy: policy,
          isMine: true,
          deliveryStatus: 'pending',
          forwarded: true,
          ...(forwardMsg.attachmentUrl ? { attachmentUrl: forwardMsg.attachmentUrl, type: forwardMsg.type, name: forwardMsg.name } : {})
        };
        setMessagesByContact((prev) => {
          const current = prev[targetUniqueId] || [];
          return {
            ...prev,
            [targetUniqueId]: [...current, optimisticMessage].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
          };
        });
        setIsForwardModalOpen(false);
        setForwardMsg(null);
        const payload = {
          receiverId: targetUniqueId,
          message: forwardMsg.text,
          disappearPolicy: policy,
          clientTempId: tempId,
          forwarded: true,
          ...(forwardMsg.attachmentUrl ? { attachmentUrl: forwardMsg.attachmentUrl, type: forwardMsg.type, name: forwardMsg.name } : {})
        };
        try {
          await sendWithRetry({ token: authToken, payload, attempts: 2 });
        } catch (e) {
          // Optionally handle error, e.g. show notification
        }
      };
    // Add to imports if not present
    import React, { useState, useRef, useEffect } from 'react';

    // Add forward modal state near other useState hooks
    const [forwardMsg, setForwardMsg] = useState(null);
    const [isForwardModalOpen, setIsForwardModalOpen] = useState(false);

    osc.type = 'sine';
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(gainValue, ctx.currentTime + startOffset);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + startOffset + duration);
          {timelineItems.map((item) => {
            if (item.type === 'date') {
              return (
                <div key={item.id} className="friends-date-divider" aria-label={`Date: ${item.label}`}>
                  <span>{item.label}</span>
                </div>
              );
            }

            if (item.type === 'unread') {
              return (
                <div
                  key={item.id}
                  className="friends-unread-divider"
                  aria-label="Unread messages"
                  ref={firstUnreadDividerRef}
                >
                  <span>{item.label}</span>
                </div>
              );
            }

            const msg = item.message;
            // Render image, file, link, or text message
            let content = null;
            if (msg.type === 'image' && msg.attachmentUrl) {
              content = (
                <div className="friends-msg-image">
                  <a href={msg.attachmentUrl} target="_blank" rel="noopener noreferrer">
                    <img src={msg.attachmentUrl} alt={msg.name || 'image'} style={{ maxWidth: 180, maxHeight: 180, borderRadius: 8 }} />
                  </a>
                  <div className="friends-msg-meta-small">{msg.name || 'Image'}</div>
                </div>
              );
            } else if (msg.type === 'file' && msg.attachmentUrl) {
              content = (
                <div className="friends-msg-file">
                  <span className="friends-msg-file-icon">📎</span>
                  <a href={msg.attachmentUrl} target="_blank" rel="noopener noreferrer">{msg.name || 'File'}</a>
                </div>
              );
            } else if (msg.type === 'link' && msg.url) {
              content = (
                <div className="friends-msg-link">
                  <a href={msg.url} target="_blank" rel="noopener noreferrer">{msg.url}</a>
                </div>
              );
            } else {
              // Detect links in text
              const urlRegex = /(https?:\/\/[^\s]+)/g;
              const text = msg.text || '';
              const parts = [];
              let lastIndex = 0;
              let match;
              while ((match = urlRegex.exec(text)) !== null) {
                if (match.index > lastIndex) {
                  parts.push({ text: text.slice(lastIndex, match.index), isLink: false });
                }
                parts.push({ text: match[0], isLink: true });
                lastIndex = match.index + match[0].length;
              }
              if (lastIndex < text.length) {
                parts.push({ text: text.slice(lastIndex), isLink: false });
              }
              content = (
                <div>
                  {parts.map((part, i) =>
                    part.isLink ? (
                      <a key={i} href={part.text} target="_blank" rel="noopener noreferrer">{part.text}</a>
                    ) : (
                      <span key={i}>{part.text}</span>
                    )
                  )}
                </div>
              );
            }
            // --- Emoji reactions UI ---
            const reactions = msg.reactions || [];
            return (
              <article key={item.id} className={`friends-msg ${msg.isMine ? 'me' : ''}`}
                style={{ position: 'relative' }}>
                {/* Reply context above message if present */}
                {msg.replyTo && (
                  <div className="friends-msg-reply-context" style={{ background: '#f1f3f4', borderLeft: '3px solid #4a5a64', padding: '4px 8px', marginBottom: 4, borderRadius: 6, fontSize: '0.95em' }}>
                    <span style={{ fontWeight: 500, color: '#4a5a64' }}>
                      Replying to: {msg.replyTo.text ? msg.replyTo.text.slice(0, 40) : 'Message'}
                    </span>
                  </div>
                )}
                {content}
                {/* Reactions display */}
                {reactions.length > 0 && (
                  <div className="friends-msg-reactions">
                    {reactions.map((r, i) => (
                      <span key={i} className="friends-msg-reaction-emoji">{r.emoji} {r.count > 1 ? r.count : ''}</span>
                    ))}
                  </div>
                )}
                {/* Reaction, Reply, and Forward buttons */}
                <button
                  className="friends-msg-reaction-btn"
                  title="React to message"
                  style={{ marginLeft: 8, fontSize: 18, background: 'none', border: 'none', cursor: 'pointer' }}
                  onClick={() => setReactionPickerFor(msg.id)}
                  aria-label="React to message"
                >
                  😊
                </button>
                <button
                  className="friends-msg-reply-btn"
                  title="Reply to message"
                  style={{ marginLeft: 4, fontSize: 18, background: 'none', border: 'none', cursor: 'pointer' }}
                  onClick={() => setReplyTo(msg)}
                  aria-label="Reply to message"
                >
                  ↩️
                </button>
                <button
                  className="friends-msg-forward-btn"
                  title="Forward message"
                  style={{ marginLeft: 4, fontSize: 18, background: 'none', border: 'none', cursor: 'pointer' }}
                  onClick={() => { setForwardMsg(msg); setIsForwardModalOpen(true); }}
                  aria-label="Forward message"
                >
                  📤
                </button>
                      {/* Forward message modal */}
                      {isForwardModalOpen && forwardMsg && (
                        <div className="friends-modal-backdrop" role="presentation" onClick={() => setIsForwardModalOpen(false)}>
                          <div className="friends-add-modal" role="dialog" aria-label="Forward message" onClick={e => e.stopPropagation()}>
                            <h4>Forward Message</h4>
                            <div style={{ marginBottom: 12 }}>
                              <div style={{ background: '#f1f3f4', padding: 8, borderRadius: 6, marginBottom: 8 }}>
                                <span style={{ color: '#4a5a64' }}>{forwardMsg.text ? forwardMsg.text.slice(0, 80) : 'Message'}</span>
                              </div>
                              <div style={{ fontWeight: 500, marginBottom: 6 }}>Select a contact to forward to:</div>
                              <div style={{ maxHeight: 180, overflowY: 'auto' }}>
                                {contacts.filter(c => c.uniqueId !== selectedContactId).map(contact => (
                                  <button
                                    key={contact.uniqueId}
                                    style={{ display: 'block', width: '100%', textAlign: 'left', padding: 8, marginBottom: 4, borderRadius: 4, border: '1px solid #eee', background: '#fff', cursor: 'pointer' }}
                                    onClick={() => handleForwardMessage(contact.uniqueId)}
                                  >
                                    {contact.displayName || contact.uniqueId}
                                  </button>
                                ))}
                              </div>
                            </div>
                            <div className="friends-add-modal-actions">
                              <button type="button" className="secondary" onClick={() => setIsForwardModalOpen(false)}>Cancel</button>
                            </div>
                          </div>
                        </div>
                      )}
                {/* Reaction picker popup */}
                {reactionPickerFor === msg.id && (
                  <div className="friends-reaction-picker" style={{ position: 'absolute', zIndex: 10, top: 32, left: 0, background: '#fff', border: '1px solid #ddd', borderRadius: 8, padding: 6, boxShadow: '0 2px 8px #0001' }}>
                    {quickEmojis.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        className="friends-emoji-chip"
                        style={{ fontSize: 20, margin: 2, padding: 2, border: 'none', background: 'none', cursor: 'pointer' }}
                        onClick={() => {
                          setMessagesByContact((prev) => {
                            const contactMsgs = prev[selectedContactId] || [];
                            return {
                              ...prev,
                              [selectedContactId]: contactMsgs.map((m) => {
                                if (m.id !== msg.id) return m;
                                // Add or update reaction
                                let newReactions = Array.isArray(m.reactions) ? [...m.reactions] : [];
                                const idx = newReactions.findIndex(r => r.emoji === emoji);
                                if (idx >= 0) {
                                  newReactions[idx] = { ...newReactions[idx], count: (newReactions[idx].count || 1) + 1 };
                                } else {
                                  newReactions.push({ emoji, count: 1 });
                                }
                                return { ...m, reactions: newReactions };
                              })
                            };
                          });
                          setReactionPickerFor(null);
                        }}
                        aria-label={`React with ${emoji}`}
                      >{emoji}</button>
                    ))}
                    <button type="button" className="secondary" style={{ marginLeft: 6 }} onClick={() => setReactionPickerFor(null)}>Cancel</button>
                  </div>
                )}
                <div className="friends-msg-meta">
                  <span>{formatChatTime(msg.createdAt)} • {getFriendlyRemaining(msg.expiresAt)}</span>
                  {msg.isMine ? (() => {
                    const receipt = getReceiptConfig(msg);
                    if (!receipt) return null;
                    return (
                      <span className={`friends-receipt ${receipt.className}`} title={receipt.title} aria-label={receipt.title}>
                        <span key={`${msg.id}-${receipt.className}`} className="friends-receipt-text">{receipt.text}</span>
                      </span>
                    );
                  })() : null}
                </div>
              </article>
            );
          })}
        {/* Close .friends-messages div here */}
        


  useEffect(() => {
    const handleResize = () => {
      setIsMobileLayout(window.innerWidth <= 768);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!isMobileLayout) {
      setMobilePane('list');
    }
  }, [isMobileLayout]);

  useEffect(() => {
    const handleDocClick = (event) => {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(event.target)) {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleDocClick);
    return () => document.removeEventListener('mousedown', handleDocClick);
  }, []);

  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key !== 'Escape') return;
      setIsMenuOpen(false);
      setIsAddModalOpen(false);
      setIsProfileModalOpen(false);
      setIsSettingsModalOpen(false);
      setIsEmojiTrayOpen(false);
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  const handleSearch = async () => {
    setHasSearchedAddFriend(true);
    setAddFriendSearchError('');
    setSearchResults([]);
    setIsSearchingAddFriend(true);

    const value = addFriendQuery.trim();
    if (!value) {
      setAddFriendSearchError('Enter an email or phone number.');
      setIsSearchingAddFriend(false);
      return;
    }

    if (!isEmailOrPhone(value)) {
      setAddFriendSearchError('Enter a valid email or phone number.');
      setIsSearchingAddFriend(false);
      return;
    }

    try {
      const data = await searchUsers(authToken, value);
      const users = data.users || [];
      setSearchResults(users);
      if (users.length === 0) {
        setAddFriendSearchError('User not found on this platform');
      }
    } catch (e) {
      setAddFriendSearchError(e.message || 'Search failed');
    } finally {
      setIsSearchingAddFriend(false);
    }
  };

  const handleAddContact = async (targetUniqueId) => {
    try {
      setError('');
      await addContact(authToken, targetUniqueId);
      setAddFriendQuery('');
      setSearchResults([]);
      setHasSearchedAddFriend(false);
      setAddFriendSearchError('');
      await loadContacts();
      // Real-time: notify both users to refresh contacts
      if (socket) {
        socket.emit('friends:refresh', { to: targetUniqueId });
      }
      setSelectedContactId(targetUniqueId);
      if (isMobileLayout) {
        setMobilePane('chat');
      }
      setSettingsSavedMessage('Friend added successfully.');
    } catch (e) {
      setError(e.message || 'Unable to add contact');
    }
  };

  const handleSaveSettings = async () => {
    try {
      setSettingsError('');
      setSettingsSavedMessage('');
      await saveUserSettings(authToken, {
        theme: settingsThemeDraft,
        notifications: settingsNotificationsDraft
      });
      await updateFriendsProfile(authToken, {
        displayName: settingsNameDraft,
        bio: settingsBioDraft
      });
      await onProfileRefresh();
      setSettingsSavedMessage('Settings saved successfully.');
    } catch (e) {
      setSettingsError(e.message || 'Unable to save settings.');
    }
  };

  const handleSendMessage = async () => {
    if (!socket || !selectedContactId || !message.trim()) return;

    const policy = selectedContact?.preferences?.defaultDisappearPolicy || { mode: 'keep' };
    const messageText = message;
    const targetUniqueId = selectedContactId;
    const tempId = makeTempMessageId();
    const optimisticMessage = {
      id: tempId,
      text: messageText,
      createdAt: new Date().toISOString(),
      expiresAt: null,
      disappearPolicy: policy,
      isMine: true,
      deliveryStatus: 'pending',
      ...(replyTo ? { replyTo: { id: replyTo.id, text: replyTo.text } } : {})
    };

    setMessagesByContact((prev) => {
      const current = prev[targetUniqueId] || [];
      return {
        ...prev,
        [targetUniqueId]: [...current, optimisticMessage].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
      };
    });

    setMessage('');
    setIsEmojiTrayOpen(false);
    setReplyTo(null);
    socket.emit('friends:typing', { toUniqueId: targetUniqueId, isTyping: false });
    socket.emit('stop_typing', { toUniqueId: targetUniqueId });
    typingActiveRef.current = false;

    const queuedItem = {
      tempId,
      toUniqueId: targetUniqueId,
      text: messageText,
      disappearPolicy: policy,
      createdAt: new Date().toISOString(),
      ...(replyTo ? { replyTo: { id: replyTo.id, text: replyTo.text } } : {})
    };

    if (!navigator.onLine) {
      upsertQueuedMessage(queuedItem);
      updateOptimisticDeliveryStatus(targetUniqueId, tempId, 'queued');
      setError('You are offline. Message queued and will resend automatically.');
      return;
    }

    pendingSendTimersRef.current[tempId] = window.setTimeout(() => {
      delete pendingSendTimersRef.current[tempId];
      upsertQueuedMessage(queuedItem);
      updateOptimisticDeliveryStatus(targetUniqueId, tempId, 'queued');
      setError('Message send timed out. Queued for automatic retry.');
    }, 12000);

    try {
      const response = await sendWithRetry({
        token: authToken,
        payload: {
          receiverId: targetUniqueId,
          message: messageText,
          disappearPolicy: policy,
          clientTempId: tempId,
          ...(replyTo ? { replyTo: { id: replyTo.id, text: replyTo.text } } : {})
        },
        attempts: 2
      });

      if (pendingSendTimersRef.current[tempId]) {
        window.clearTimeout(pendingSendTimersRef.current[tempId]);
        delete pendingSendTimersRef.current[tempId];
      }

      if (response?.message?.id) {
        const confirmed = {
          ...response.message,
          isMine: true,
          deliveryStatus: response.message.deliveryStatus || 'sent'
        };
        setMessagesByContact((prev) => {
          const current = prev[targetUniqueId] || [];
          const withoutTemp = current.filter((m) => m.id !== tempId);
          return {
            ...prev,
            [targetUniqueId]: mergeMessagesById(withoutTemp, [confirmed])
          };
        });
      } else {
        updateOptimisticDeliveryStatus(targetUniqueId, tempId, 'sent');
      }
      removeQueuedMessage(tempId);
    } catch (apiError) {
      if (pendingSendTimersRef.current[tempId]) {
        window.clearTimeout(pendingSendTimersRef.current[tempId]);
        delete pendingSendTimersRef.current[tempId];
      }
      upsertQueuedMessage(queuedItem);
      updateOptimisticDeliveryStatus(targetUniqueId, tempId, 'queued');
      setError(apiError?.message || 'Message send failed. Queued for automatic retry.');
    }
  };

  const handleMessageInputChange = (value) => {
    setMessage(value);
    if (!socket || !selectedContactId) return;

    const hasText = value.trim().length > 0;
    if (hasText && !typingActiveRef.current) {
      socket.emit('friends:typing', { toUniqueId: selectedContactId, isTyping: true });
      socket.emit('typing', { toUniqueId: selectedContactId });
      typingActiveRef.current = true;
    }

    if (!hasText && typingActiveRef.current) {
      socket.emit('friends:typing', { toUniqueId: selectedContactId, isTyping: false });
      socket.emit('stop_typing', { toUniqueId: selectedContactId });
      typingActiveRef.current = false;
    }

    if (typingStopTimerRef.current) {
      window.clearTimeout(typingStopTimerRef.current);
    }

    typingStopTimerRef.current = window.setTimeout(() => {
      if (typingActiveRef.current) {
        socket.emit('friends:typing', { toUniqueId: selectedContactId, isTyping: false });
        socket.emit('stop_typing', { toUniqueId: selectedContactId });
        typingActiveRef.current = false;
      }
    }, 1600);
  };

  const handleMessagesScroll = async (event) => {
    if (!selectedContactId) return;
    const container = event.currentTarget;
    if (container.scrollTop > 60) return;

    if (loadingOlderByContact[selectedContactId]) return;
    if (!hasMoreByContact[selectedContactId]) return;

    const before = oldestCursorByContact[selectedContactId];
    if (!before) return;

    const previousHeight = container.scrollHeight;
    setLoadingOlderByContact((prev) => ({ ...prev, [selectedContactId]: true }));

    try {
      const data = await fetchConversationMessages(authToken, selectedContactId, {
        before,
        limit: 40
      });
      const incoming = data.messages || [];

      setMessagesByContact((prev) => ({
        ...prev,
        [selectedContactId]: mergeMessagesById(incoming, prev[selectedContactId] || [])
      }));

      if (incoming[0]?.createdAt) {
        setOldestCursorByContact((prev) => ({ ...prev, [selectedContactId]: incoming[0].createdAt }));
      }
      setHasMoreByContact((prev) => ({ ...prev, [selectedContactId]: incoming.length >= 40 }));

      window.requestAnimationFrame(() => {
        container.scrollTop = container.scrollHeight - previousHeight + container.scrollTop;
      });
    } catch (e) {
      setError(e.message || 'Failed to load older messages.');
    } finally {
      setLoadingOlderByContact((prev) => ({ ...prev, [selectedContactId]: false }));
    }
  };

  const handleSelectContact = (contactUniqueId) => {
    setSelectedContactId(contactUniqueId);
    setIsEmojiTrayOpen(false);
    if (isMobileLayout) {
      setMobilePane('chat');
    }
  };

  const handleOpenAddModal = () => {
    setAddFriendQuery('');
    setSearchResults([]);
    setHasSearchedAddFriend(false);
    setAddFriendSearchError('');
    setIsAddModalOpen(true);
  };


  const contactTyping = selectedContactId ? !!typingByContact[selectedContactId] : false;

  // Fix: Define activeMessages for timelineItems and chat rendering
  const activeMessages = useMemo(() => {
    if (!selectedContactId) return [];
    return messagesByContact[selectedContactId] || [];
  }, [selectedContactId, messagesByContact]);

  const timelineItems = useMemo(() => {
    const items = [];
    let lastDayKey = '';
    let unreadInserted = false;

    for (const msg of activeMessages) {
      const createdAtDate = new Date(msg.createdAt);
      const dayKey = Number.isNaN(createdAtDate.getTime())
        ? ''
        : `${createdAtDate.getFullYear()}-${createdAtDate.getMonth()}-${createdAtDate.getDate()}`;

      if (dayKey && dayKey !== lastDayKey) {
        items.push({
          type: 'date',
          id: `date-${dayKey}`,
          label: formatDayLabel(msg.createdAt)
        });
        lastDayKey = dayKey;
      }

      if (!unreadInserted && !msg.isMine && !msg.readAt) {
        items.push({
          type: 'unread',
          id: `unread-${msg.id}`,
          label: 'Unread messages'
        });
        unreadInserted = true;
      }

      items.push({ type: 'message', id: msg.id, message: msg });
    }

    return items;
  }, [activeMessages]);

  useEffect(() => {
    if (!selectedContactId || !shouldAutoScrollUnreadRef.current) return;

    const rafId = window.requestAnimationFrame(() => {
      if (firstUnreadDividerRef.current) {
        firstUnreadDividerRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else if (messagesContainerRef.current) {
        messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
      }
      shouldAutoScrollUnreadRef.current = false;
    });

    return () => window.cancelAnimationFrame(rafId);
  }, [selectedContactId, timelineItems]);

  const handleChatTouchStart = (event) => {
    if (!isMobileLayout || mobilePane !== 'chat') return;
    const touch = event.touches?.[0];
    if (!touch) return;
    swipeStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      at: Date.now()
    };
  };

  const handleChatTouchEnd = (event) => {
    if (!isMobileLayout || mobilePane !== 'chat') return;
    const start = swipeStartRef.current;
    swipeStartRef.current = null;
    if (!start) return;

    const touch = event.changedTouches?.[0];
    if (!touch) return;

    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    const elapsed = Date.now() - start.at;
    const startedFromEdge = start.x <= 48;

    if (startedFromEdge && dx > 70 && Math.abs(dy) < 64 && elapsed < 700) {
      setMobilePane('list');
    }
  };

  // Fix: filteredContacts must be defined as a hook, not inside JSX
  const filteredContacts = useMemo(() => {
    const search = chatSearch.trim().toLowerCase();
    if (!search) return contacts;
    return contacts.filter(
      (c) =>
        (c.displayName && c.displayName.toLowerCase().includes(search)) ||
        (c.uniqueId && c.uniqueId.toLowerCase().includes(search))
    );
  }, [contacts, chatSearch]);

  // Chat menu state and handlers (must be before return)
  const [isChatMenuOpen, setIsChatMenuOpen] = useState(false);
  const [isClearChatModalOpen, setIsClearChatModalOpen] = useState(false);
  const [isMediaModalOpen, setIsMediaModalOpen] = useState(false);
  const [isDisappearModalOpen, setIsDisappearModalOpen] = useState(false);
  const [isMuteModalOpen, setIsMuteModalOpen] = useState(false);

  const handleOpenClearChatModal = () => {
    setIsChatMenuOpen(false);
    setIsClearChatModalOpen(true);
  };
  const handleOpenMediaModal = () => {
    setIsChatMenuOpen(false);
    setIsMediaModalOpen(true);
  };
  const handleOpenDisappearModal = () => {
    setIsChatMenuOpen(false);
    setIsDisappearModalOpen(true);
  };
  const handleOpenMuteModal = () => {
    setIsChatMenuOpen(false);
    setIsMuteModalOpen(true);
  };

  return (
    <div className={`friends-shell ${isMobileLayout ? `mobile-${mobilePane}` : ''}`}>
      <aside className="friends-side">
        {/* Friend Requests Section */}
        <div className="friends-requests-section">
          <h5>Requests</h5>
          {requestsError ? <div className="friends-error">{requestsError}</div> : null}
          {incomingRequests.length === 0 && outgoingRequests.length === 0 ? (
            <div className="friends-empty-list">No friend requests</div>
          ) : null}
          {incomingRequests.length > 0 ? (
            <div className="friends-incoming-requests">
              <strong>Incoming</strong>
              {incomingRequests.map((req) => (
                <div key={req._id} className="friends-request-card">
                  <span>From: {req.fromUid}</span>
                  <button onClick={() => handleAcceptRequest(req._id)}>Accept</button>
                  <button onClick={() => handleRejectRequest(req._id)}>Reject</button>
                </div>
              ))}
            </div>
          ) : null}
          {outgoingRequests.length > 0 ? (
            <div className="friends-outgoing-requests">
              <strong>Outgoing</strong>
              {outgoingRequests.map((req) => (
                <div key={req._id} className="friends-request-card">
                  <span>To: {req.toUid}</span>
                  <span>Status: {req.status}</span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
        <header className="friends-side-header">
          <div className="friends-menu-wrap" ref={menuRef}>
            <button
              type="button"
              className="friends-menu-button"
              onClick={() => setIsMenuOpen((prev) => !prev)}
              aria-expanded={isMenuOpen}
              aria-haspopup="menu"
              aria-label="Open dashboard menu"
            >
              ☰
            </button>
            {isMenuOpen ? (
              <div className="friends-menu-dropdown" role="menu" aria-label="Dashboard menu">
                <button
                  type="button"
                  className="friends-menu-item"
                  onClick={() => {
                    setIsMenuOpen(false);
                    setIsProfileModalOpen(true);
                  }}
                >
                  Profile
                </button>
                <button
                  type="button"
                  className="friends-menu-item"
                  onClick={() => {
                    setIsMenuOpen(false);
                    setIsSettingsModalOpen(true);
                  }}
                >
                  Settings
                </button>
                <button
                  type="button"
                  className="friends-menu-item"
                  onClick={() => {
                    setIsMenuOpen(false);
                    onLogout();
                  }}
                >
                  Logout
                </button>
              </div>
            ) : null}
          </div>

          <div className="friends-self-meta">
            <strong>Chats</strong>
            <span className="friends-id-badge">{profile.displayName || profile.uniqueId}</span>
          </div>
        </header>

        <div className="friends-sidebar-search-wrap">
          <input
            className="friends-sidebar-search"
            type="search"
            placeholder="Search chats"
            value={chatSearchInput}
            onChange={(e) => setChatSearchInput(e.target.value)}
            aria-label="Search chats"
          />
        </div>


        <div className="friends-contacts" aria-label="Friends conversations">
          {filteredContacts.length === 0 ? (
            <div className="friends-empty-list">
              {contacts.length === 0 ? 'No chats yet. Tap + to add people.' : 'No chats match your search.'}
            </div>
          ) : null}
          {filteredContacts.map((contact) => {
            const listReceipt = getListReceipt(contact.lastMessage);
            const listReceiptClass = contact.lastMessage?.deliveryStatus === 'queued' ? 'queued' : '';
            return (
              <button
                key={contact.uniqueId}
                className={`friends-contact ${selectedContactId === contact.uniqueId ? 'active' : ''}`}
                type="button"
                onClick={() => handleSelectContact(contact.uniqueId)}
              >
                <div className="friends-contact-avatar" aria-hidden="true">
                  {(contact.displayName || contact.uniqueId || 'FR').slice(0, 2).toUpperCase()}
                </div>

                <div className="friends-contact-content">
                  <div className="friends-contact-top">
                    <span className="friends-contact-name">{contact.displayName || contact.uniqueId}</span>
                    <span className="friends-contact-time">{formatChatTime(contact.lastMessage?.createdAt || contact.updatedAt)}</span>
                  </div>

                  <div className="friends-contact-bottom">
                    <span className="friends-contact-preview">
                      {contact.lastMessage?.text ? (
                        <>
                          {(contact.lastMessage?.isMine || contact.lastMessage?.fromUniqueId === profile.uniqueId) ? (
                            <>
                              <span className={`friends-list-receipt ${listReceiptClass}`.trim()} aria-hidden="true">{listReceipt}</span>
                              <span className="friends-list-prefix">You:</span>{' '}
                            </>
                          ) : null}
                          {contact.lastMessage.text}
                        </>
                      ) : 'Tap to start chatting'}
                    </span>

                    <span className="friends-contact-signals">
                      {/* Badge for requests */}
                      {incomingRequests.some((req) => req.fromUid === contact.uid) ? (
                        <span className="friends-request-badge">!</span>
                      ) : null}
                      <span className={`friends-presence-dot ${contact.online ? 'online' : 'offline'}`} title={contact.online ? 'Online' : 'Offline'} />
                      {contact.unreadCount > 0 ? <span className="friends-unread-badge">{contact.unreadCount}</span> : null}
                    </span>
                    {/* Remove friend button */}
                    <button className="friends-remove-btn" onClick={() => handleRemoveFriend(contact.uniqueId)}>
                      Remove
                    </button>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </aside>

      <section
        className="friends-main"
        onTouchStart={handleChatTouchStart}
        onTouchEnd={handleChatTouchEnd}
      >
        <header className="friends-chat-header">
          <div className="friends-chat-header-main">
            {isMobileLayout && mobilePane === 'chat' ? (
              <button
                type="button"
                className="secondary friends-mobile-back"
                onClick={() => setMobilePane('list')}
              >
                Back
              </button>
            ) : null}

            {selectedContact ? (
              <>
                <div className="friends-contact-avatar" aria-hidden="true">
                  {(selectedContact.displayName || selectedContact.uniqueId || 'FR').slice(0, 2).toUpperCase()}
                </div>
                <div className="friends-chat-header-copy">
                  <strong>{selectedContact.displayName || selectedContact.uniqueId}</strong>
                  {selectedContact?.preferences?.muted && (
                    <span title="Muted" style={{ color: '#b85c5c', marginLeft: 6, fontSize: '1.1em' }}>🔕</span>
                  )}
                  {/* Badge for requests */}
                  {incomingRequests.some((req) => req.fromUid === selectedContact.uid) ? (
                    <span className="friends-request-badge">!</span>
                  ) : null}
                  <small>
                    {contactTyping
                      ? 'User is typing...'
                      : selectedContact.online
                        ? 'online'
                        : (selectedContact.lastSeen ? `last seen ${formatChatTime(selectedContact.lastSeen)}` : selectedContact.uniqueId)}
                  </small>
                </div>
                {/* Three-dot menu */}
                <div className="friends-chat-menu-wrap" style={{ marginLeft: 'auto', position: 'relative' }}>
                  <button
                    type="button"
                    className="friends-chat-menu-btn"
                    aria-label="Open chat menu"
                    onClick={() => setIsChatMenuOpen((prev) => !prev)}
                  >
                    ⋮
                  </button>
                  {isChatMenuOpen && (
                    <div className="friends-chat-menu-dropdown" role="menu" aria-label="Chat menu">
                      <button type="button" className="friends-chat-menu-item" onClick={handleOpenClearChatModal}>Clear Chat</button>
                      <button type="button" className="friends-chat-menu-item" onClick={handleOpenMediaModal}>Media, Links, and Documents</button>
                      <button type="button" className="friends-chat-menu-item" onClick={handleOpenDisappearModal}>Disappearing Messages</button>
                      <button type="button" className="friends-chat-menu-item" onClick={handleOpenMuteModal}>Mute Notifications</button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="friends-chat-header-copy">
                <strong>Select a chat</strong>
                <small>Choose a friend from the left sidebar.</small>
              </div>
            )}
          </div>

        </header>



        <div className="friends-messages" ref={messagesContainerRef} onScroll={handleMessagesScroll}>
          {!selectedContact ? (
            <div className="friends-chat-empty">Select a friend from chats to start messaging.</div>
          ) : null}

          {timelineItems.map((item) => {
            if (item.type === 'date') {
              return (
                <div key={item.id} className="friends-date-divider" aria-label={`Date: ${item.label}`}>
                  <span>{item.label}</span>
                </div>
              );
            }

            if (item.type === 'unread') {
              return (
                <div
                  key={item.id}
                  className="friends-unread-divider"
                  aria-label="Unread messages"
                  ref={firstUnreadDividerRef}
                >
                  <span>{item.label}</span>
                </div>
              );
            }

            const msg = item.message;
            // Render image, file, link, or text message
            let content = null;
            if (msg.type === 'image' && msg.attachmentUrl) {
              content = (
                <div className="friends-msg-image">
                  <a href={msg.attachmentUrl} target="_blank" rel="noopener noreferrer">
                    <img src={msg.attachmentUrl} alt={msg.name || 'image'} style={{ maxWidth: 180, maxHeight: 180, borderRadius: 8 }} />
                  </a>
                  <div className="friends-msg-meta-small">{msg.name || 'Image'}</div>
                </div>
              );
            } else if (msg.type === 'file' && msg.attachmentUrl) {
              content = (
                <div className="friends-msg-file">
                  <span className="friends-msg-file-icon">📎</span>
                  <a href={msg.attachmentUrl} target="_blank" rel="noopener noreferrer">{msg.name || 'File'}</a>
                </div>
              );
            } else if (msg.type === 'link' && msg.url) {
              content = (
                <div className="friends-msg-link">
                  <a href={msg.url} target="_blank" rel="noopener noreferrer">{msg.url}</a>
                </div>
              );
            } else {
              // Detect links in text
                const urlRegex = /(https?:\/\/[^\s]+)/g;
                const text = msg.text || '';
                const parts = [];
                let lastIndex = 0;
                let match;
                while ((match = urlRegex.exec(text)) !== null) {
                  if (match.index > lastIndex) {
                    parts.push({ text: text.slice(lastIndex, match.index), isLink: false });
                  }
                  parts.push({ text: match[0], isLink: true });
                  lastIndex = match.index + match[0].length;
                }
                if (lastIndex < text.length) {
                  parts.push({ text: text.slice(lastIndex), isLink: false });
                }
                content = (
                  <div>
                    {parts.map((part, i) =>
                      part.isLink ? (
                        <a key={i} href={part.text} target="_blank" rel="noopener noreferrer">{part.text}</a>
                      ) : (
                        <span key={i}>{part.text}</span>
                      )
                    )}
                  </div>
                );
            }
            // --- Emoji reactions UI ---
            const reactions = msg.reactions || [];
            return (
              <article key={item.id} className={`friends-msg ${msg.isMine ? 'me' : ''}`}
                style={{ position: 'relative' }}>
                {content}
                {/* Reactions display */}
                {reactions.length > 0 && (
                  <div className="friends-msg-reactions">
                    {reactions.map((r, i) => (
                      <span key={i} className="friends-msg-reaction-emoji">{r.emoji} {r.count > 1 ? r.count : ''}</span>
                    ))}
                  </div>
                )}
                {/* Reaction button */}
                <button
                  className="friends-msg-reaction-btn"
                  title="React to message"
                  style={{ marginLeft: 8, fontSize: 18, background: 'none', border: 'none', cursor: 'pointer' }}
                  onClick={() => setReactionPickerFor(msg.id)}
                  aria-label="React to message"
                >
                  😊
                </button>
                {/* Reaction picker popup */}
                {reactionPickerFor === msg.id && (
                  <div className="friends-reaction-picker" style={{ position: 'absolute', zIndex: 10, top: 32, left: 0, background: '#fff', border: '1px solid #ddd', borderRadius: 8, padding: 6, boxShadow: '0 2px 8px #0001' }}>
                    {quickEmojis.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        className="friends-emoji-chip"
                        style={{ fontSize: 20, margin: 2, padding: 2, border: 'none', background: 'none', cursor: 'pointer' }}
                        onClick={() => {
                          setMessagesByContact((prev) => {
                            const contactMsgs = prev[selectedContactId] || [];
                            return {
                              ...prev,
                              [selectedContactId]: contactMsgs.map((m) => {
                                if (m.id !== msg.id) return m;
                                // Add or update reaction
                                let newReactions = Array.isArray(m.reactions) ? [...m.reactions] : [];
                                const idx = newReactions.findIndex(r => r.emoji === emoji);
                                if (idx >= 0) {
                                  newReactions[idx] = { ...newReactions[idx], count: (newReactions[idx].count || 1) + 1 };
                                } else {
                                  newReactions.push({ emoji, count: 1 });
                                }
                                return { ...m, reactions: newReactions };
                              })
                            };
                          });
                          setReactionPickerFor(null);
                        }}
                        aria-label={`React with ${emoji}`}
                      >{emoji}</button>
                    ))}
                    <button type="button" className="secondary" style={{ marginLeft: 6 }} onClick={() => setReactionPickerFor(null)}>Cancel</button>
                  </div>
                )}
                <div className="friends-msg-meta">
                  <span>{formatChatTime(msg.createdAt)} • {getFriendlyRemaining(msg.expiresAt)}</span>
                  {msg.isMine ? (() => {
                    const receipt = getReceiptConfig(msg);
                    if (!receipt) return null;
                    return (
                      <span className={`friends-receipt ${receipt.className}`} title={receipt.title} aria-label={receipt.title}>
                        <span key={`${msg.id}-${receipt.className}`} className="friends-receipt-text">{receipt.text}</span>
                      </span>
                    );
                  })() : null}
                </div>
              </article>
            );
          })}

        {/* End of .friends-messages */}

        {/* Reply preview above input if replying */}
        {replyTo && (
          <div className="friends-reply-preview" style={{ background: '#f1f3f4', borderLeft: '3px solid #4a5a64', padding: '6px 10px', marginBottom: 4, borderRadius: 6, display: 'flex', alignItems: 'center' }}>
            <span style={{ fontWeight: 500, color: '#4a5a64', marginRight: 8 }}>Replying to:</span>
            <span style={{ flex: 1, color: '#333' }}>{replyTo.text ? replyTo.text.slice(0, 60) : 'Message'}</span>
            <button type="button" style={{ marginLeft: 8, background: 'none', border: 'none', cursor: 'pointer', color: '#b85c5c', fontSize: 18 }} onClick={() => setReplyTo(null)} aria-label="Cancel reply">✕</button>
          </div>
        )}
        <div className="friends-input-row" style={{ position: 'relative' }}>
            <button
              type="button"
              className="friends-action-toggle"
              onClick={() => setIsActionTrayOpen((prev) => !prev)}
              aria-label="Open actions"
              disabled={!selectedContact}
            >
              +
            </button>

            <input
              placeholder={selectedContact ? 'Type a message' : 'Add or select a friend to start'}
              value={message}
              onChange={(e) => handleMessageInputChange(e.target.value)}
              disabled={!selectedContact || isRecording || !!voicePreview}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              style={isRecording || voicePreview ? { opacity: 0.5 } : {}}
            />

            {/* Microphone button for voice messages */}
            <button
              type="button"
              className={`friends-action-toggle${isRecording ? ' recording' : ''}`}
              aria-label={isRecording ? 'Recording...' : 'Record voice message'}
              disabled={!selectedContact || isRecording || !!voicePreview}
              onMouseDown={handleStartRecording}
              onMouseUp={handleStopRecording}
              onTouchStart={handleStartRecording}
              onTouchEnd={handleStopRecording}
              style={{ marginLeft: 4, background: isRecording ? '#ffe5e5' : undefined }}
            >
              <span role="img" aria-label="mic">🎤</span>
            </button>

            <button type="button" onClick={handleSendMessage} disabled={!selectedContact || !message.trim() || isRecording || !!voicePreview}>
              Send
            </button>
          </div>

          {/* Voice recording indicator and preview modal */}
          {isRecording && (
            <div className="friends-voice-recording-indicator">
              <span role="img" aria-label="recording">🔴</span> Recording... {recordingTime}s
            </div>
          )}

          {/* Image preview modal with caption */}
          {pendingImage && (
            <div className="friends-modal-backdrop" role="presentation" onClick={() => setPendingImage(null)}>
              <div className="friends-add-modal" role="dialog" aria-label="Image preview" onClick={e => e.stopPropagation()}>
                <h4>Send Image</h4>
                <img src={pendingImage.url} alt={pendingImage.name || 'preview'} style={{ maxWidth: '100%', maxHeight: 320, borderRadius: 8, marginBottom: 12 }} />
                <input
                  type="text"
                  placeholder="Add a caption (optional)"
                  value={imageCaption}
                  onChange={e => {
                    setImageCaption(e.target.value);
                    setPendingImage(img => img ? { ...img, caption: e.target.value } : img);
                  }}
                  style={{ width: '100%', marginBottom: 12 }}
                  maxLength={200}
                  autoFocus
                />
                <div className="friends-add-modal-actions">
                  <button type="button" onClick={handleSendImage}>Send</button>
                  <button type="button" className="secondary" onClick={() => setPendingImage(null)}>Cancel</button>
                </div>
              </div>
            </div>
          )}

          {isActionTrayOpen && selectedContact && (
            <div className="friends-action-tray" aria-label="Action menu">
              <button
                type="button"
                className="friends-action-item"
                onClick={() => {
                  setIsEmojiTrayOpen((prev) => !prev);
                  setIsActionTrayOpen(false);
                }}
              >
                😀 Emoji
              </button>
              <button
                type="button"
                className="friends-action-item"
                onClick={() => {
                  imageInputRef.current?.click();
                  setIsActionTrayOpen(false);
                }}
              >
                🖼️ Image
              </button>
              <button
                type="button"
                className="friends-action-item"
                onClick={() => {
                  fileInputRef.current?.click();
                  setIsActionTrayOpen(false);
                }}
              >
                📎 File
              </button>
              <button
                type="button"
                className="friends-action-item close"
                onClick={() => setIsActionTrayOpen(false)}
              >
                ✕ Close
              </button>
              <input
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                ref={imageInputRef}
                onChange={handleImageUpload}
              />
              <input
                type="file"
                style={{ display: 'none' }}
                ref={fileInputRef}
                onChange={handleFileUpload}
              />
            </div>
          )}

          {error ? <p className="friends-error">{error}</p> : null}
          {offlineQueueCount > 0 ? (
            <p className="friends-note" aria-live="polite">
              {offlineQueueCount} message{offlineQueueCount === 1 ? '' : 's'} queued for resend.
            </p>
          ) : null}
        </div>
      </section>

      <button
        type="button"
        className="friends-fab"
        onClick={handleOpenAddModal}
        aria-label="Add people"
      >
        +
      </button>

      {isAddModalOpen ? (
        <div className="friends-modal-backdrop" role="presentation" onClick={() => setIsAddModalOpen(false)}>
          <div
            className="friends-add-modal"
            role="dialog"
            aria-label="Add people"
            onClick={(e) => e.stopPropagation()}
          >
            <h4>Add people</h4>
            <div className="friends-add-tabs">
              <button
                type="button"
                className={addBy === 'email' ? 'active' : ''}
                onClick={() => {
                  setAddBy('email');
                  setAddFriendQuery('');
                  setSearchResults([]);
                  setHasSearchedAddFriend(false);
                  setAddFriendSearchError('');
                }}
              >By Email/Phone</button>
              <button
                type="button"
                className={addBy === 'id' ? 'active' : ''}
                onClick={() => {
                  setAddBy('id');
                  setAddFriendQuery('');
                  setSearchResults([]);
                  setHasSearchedAddFriend(false);
                  setAddFriendSearchError('');
                }}
              >By Unique ID</button>
            </div>
            {addBy === 'email' ? (
              <>
                <p>Add users by email or phone number. Only existing users can be added.</p>
                <input
                  placeholder="example@email.com or +911234567890"
                  value={addFriendQuery}
                  onChange={(e) => setAddFriendQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleSearch();
                    }
                  }}
                  autoFocus
                />
                <div className="friends-add-modal-actions left">
                  <button type="button" onClick={handleSearch}>Search</button>
                </div>
              </>
            ) : (
              <>
                <p>Add users by their unique ID. Only existing users can be added.</p>
                <input
                  placeholder="Enter unique ID (case sensitive)"
                  value={addFriendQuery}
                  onChange={(e) => setAddFriendQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleSearchById();
                    }
                  }}
                  autoFocus
                />
                <div className="friends-add-modal-actions left">
                  <button type="button" onClick={handleSearchById}>Search</button>
                </div>
              </>
            )}
            <div className="friends-results-label">Results</div>
            {isSearchingAddFriend ? <div className="friends-empty">Searching...</div> : null}
            {addFriendSearchError ? <div className="friends-empty">{addFriendSearchError}</div> : null}
            <div className="friends-add-results">
              {hasSearchedAddFriend && !addFriendSearchError && searchResults.length === 0 ? (
                <div className="friends-empty">User not found on this platform</div>
              ) : null}
              {searchResults.map((item) => (
                <div key={item.uniqueId} className="friends-search-result-card">
                  <div className="friends-search-result-meta">
                    <strong>{item.displayName || item.uniqueId}</strong>
                    <small>{item.email || item.phoneNumber || item.uniqueId}</small>
                  </div>
                  <button
                    type="button"
                    className="friends-search-result"
                    onClick={() => {
                      handleAddContact(item.uniqueId);
                      setIsAddModalOpen(false);
                    }}
                  >
                    Add Friend
                  </button>
                </div>
              ))}
            </div>
            <div className="friends-add-modal-actions">
              <button
                type="button"
                disabled={!searchResults?.[0]?.uniqueId}
                onClick={() => {
                  const first = searchResults?.[0];
                  if (!first?.uniqueId) return;
                  handleAddContact(first.uniqueId);
                  setIsAddModalOpen(false);
                }}
              >
                Add First Match
              </button>
              <button type="button" className="secondary" onClick={() => setIsAddModalOpen(false)}>Close</button>
            </div>
          </div>
        </div>
      ) : null}

      {isMediaModalOpen ? (
        <div className="friends-modal-backdrop" role="presentation" onClick={() => setIsMediaModalOpen(false)}>
          <div className="friends-add-modal friends-media-modal" role="dialog" aria-label="Media, Links, and Documents" onClick={e => e.stopPropagation()}>
            <h4>Media, Links, and Documents</h4>
            <div className="friends-media-gallery">
              {/* Gallery: show images, files, and links from this chat */}
              {(() => {
                const messages = messagesByContact[selectedContactId] || [];
                const images = messages.filter(m => m.type === 'image');
                const files = messages.filter(m => m.type === 'file');
                const links = messages.filter(m => m.type === 'link');
                if (images.length === 0 && files.length === 0 && links.length === 0) {
                  return <div className="friends-empty">No media, files, or links found in this chat.</div>;
                }
                return <>
                  {images.length > 0 && <>
                    <div className="friends-media-section"><strong>Images</strong></div>
                    <div className="friends-media-list images">
                      {images.map(img => (
                        <div key={img.id} className="friends-media-thumb">
                          <img src={img.url || img.attachmentUrl} alt={img.name || 'image'} style={{ maxWidth: 80, maxHeight: 80, borderRadius: 8 }} />
                          <div className="friends-media-meta">{img.name || 'Image'}</div>
                          <a href={img.url || img.attachmentUrl} target="_blank" rel="noopener noreferrer" className="friends-media-download">Open</a>
                        </div>
                      ))}
                    </div>
                  </>}
                  {files.length > 0 && <>
                    <div className="friends-media-section"><strong>Files</strong></div>
                    <div className="friends-media-list files">
                      {files.map(file => (
                        <div key={file.id} className="friends-media-thumb">
                          <div className="friends-media-icon">📎</div>
                          <div className="friends-media-meta">{file.name || 'File'}</div>
                          <a href={file.url || file.attachmentUrl} target="_blank" rel="noopener noreferrer" className="friends-media-download">Download</a>
                        </div>
                      ))}
                    </div>
                  </>}
                  {links.length > 0 && <>
                    <div className="friends-media-section"><strong>Links</strong></div>
                    <div className="friends-media-list links">
                      {links.map(link => (
                        <div key={link.id} className="friends-media-thumb">
                          <a href={link.url} target="_blank" rel="noopener noreferrer" className="friends-media-link">{link.url}</a>
                        </div>
                      ))}
                    </div>
                  </>}
                </>;
              })()}
            </div>
            <div className="friends-add-modal-actions">
              <button type="button" className="secondary" onClick={() => setIsMediaModalOpen(false)}>Close</button>
            </div>
          </div>
        </div>
      ) : null}

      {isDisappearModalOpen ? (
        <div className="friends-modal-backdrop" role="presentation" onClick={() => setIsDisappearModalOpen(false)}>
          <div className="friends-add-modal" role="dialog" aria-label="Disappearing Messages" onClick={e => e.stopPropagation()}>
            <h4>Disappearing Messages</h4>
            <div style={{ margin: '16px 0' }}>
              <p>Set how long messages in this chat are kept before disappearing for both users.</p>
              <select
                value={selectedContact?.preferences?.defaultDisappearPolicy?.mode || 'keep'}
                onChange={async (e) => {
                  const mode = e.target.value;
                  let policy = { mode };
                  if (mode === 'custom') {
                    const customDate = prompt('Enter expiry date/time (YYYY-MM-DD HH:mm):');
                    if (customDate) policy = { mode: 'custom', until: customDate };
                  }
                  try {
                    await updateContactPreferences(authToken, selectedContactId, { defaultDisappearPolicy: policy });
                    setIsDisappearModalOpen(false);
                    await loadContacts();
                  } catch (err) {
                    setError(err.message || 'Failed to update disappear policy');
                  }
                }}
                style={{ width: '100%', margin: '10px 0' }}
              >
                <option value="keep">Keep (never disappear)</option>
                <option value="1h">1 hour</option>
                <option value="24h">24 hours</option>
                <option value="3d">3 days</option>
                <option value="7d">7 days</option>
                <option value="custom">Custom date/time</option>
              </select>
              <div style={{ fontSize: '0.97em', color: '#4a5a64' }}>
                Current: {(() => {
                  const p = selectedContact?.preferences?.defaultDisappearPolicy;
                  if (!p || p.mode === 'keep') return 'Keep';
                  if (p.mode === 'custom') return `Until ${p.until}`;
                  return p.mode;
                })()}
              </div>
            </div>
            <div className="friends-add-modal-actions">
              <button type="button" className="secondary" onClick={() => setIsDisappearModalOpen(false)}>Close</button>
            </div>
          </div>
        </div>
      ) : null}

      {isMuteModalOpen ? (
        <div className="friends-modal-backdrop" role="presentation" onClick={() => setIsMuteModalOpen(false)}>
          <div className="friends-add-modal" role="dialog" aria-label="Mute Notifications" onClick={e => e.stopPropagation()}>
            <h4>Mute Notifications</h4>
            <div style={{ margin: '16px 0' }}>
              <p>Mute or unmute notifications for this chat. Muted chats will not trigger sound or desktop notifications.</p>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="checkbox"
                  checked={!!selectedContact?.preferences?.muted}
                  onChange={async (e) => {
                    try {
                      await updateContactPreferences(authToken, selectedContactId, { muted: e.target.checked });
                      setIsMuteModalOpen(false);
                      await loadContacts();
                    } catch (err) {
                      setError(err.message || 'Failed to update mute state');
                    }
                  }}
                />
                Muted
              </label>
              <div style={{ fontSize: '0.97em', color: '#4a5a64', marginTop: 6 }}>
                Current: {selectedContact?.preferences?.muted ? 'Muted' : 'Unmuted'}
              </div>
            </div>
            <div className="friends-add-modal-actions">
              <button type="button" className="secondary" onClick={() => setIsMuteModalOpen(false)}>Close</button>
            </div>
          </div>
        </div>
      ) : null}

      {isProfileModalOpen ? (
        <div className="friends-modal-backdrop" role="presentation" onClick={() => setIsProfileModalOpen(false)}>
          <div className="friends-profile-modal" role="dialog" aria-label="Profile" onClick={(e) => e.stopPropagation()}>
            <h4>Profile</h4>
            <p><strong>Name:</strong> {profile.displayName || 'Not set'}</p>
            <p><strong>Unique ID:</strong> {profile.uniqueId}</p>
            <p><strong>Email:</strong> {profile.email || 'Not set'}</p>
            <p><strong>Phone:</strong> {profile.phoneNumber || 'Not set'}</p>
            <p><strong>Avatar:</strong> {profile.photoURL ? 'Available' : 'Not set'}</p>
            <p><strong>Bio:</strong> {profile.bio || 'No bio yet.'}</p>
            <div className="friends-add-modal-actions">
              <button type="button" className="secondary" onClick={() => setIsProfileModalOpen(false)}>Close</button>
            </div>
          </div>
        </div>
      ) : null}

      {isSettingsModalOpen ? (
        <div className="friends-modal-backdrop" role="presentation" onClick={() => setIsSettingsModalOpen(false)}>
          <div className="friends-settings-modal" role="dialog" aria-label="Settings" onClick={(e) => e.stopPropagation()}>
            <h4>Settings</h4>
            <p>Update your profile details.</p>

            <div className="friends-row">
              <input
                value={settingsNameDraft}
                onChange={(e) => setSettingsNameDraft(e.target.value)}
                placeholder="Display name"
              />
            </div>

            <div className="friends-row">
              <textarea
                rows={4}
                value={settingsBioDraft}
                onChange={(e) => setSettingsBioDraft(e.target.value)}
                placeholder="Bio"
              />
            </div>

            <div className="friends-row">
              <select
                value={settingsThemeDraft}
                onChange={(e) => setSettingsThemeDraft(e.target.value)}
                aria-label="Theme setting"
              >
                <option value="light">Light theme</option>
                <option value="dark">Dark theme</option>
              </select>
            </div>

            <div className="friends-row">
              <label>
                <input
                  type="checkbox"
                  checked={settingsNotificationsDraft}
                  onChange={(e) => setSettingsNotificationsDraft(e.target.checked)}
                />{' '}
                Notifications enabled
              </label>
            </div>

            {settingsSavedMessage ? <p className="friends-note">{settingsSavedMessage}</p> : null}
            {settingsError ? <p className="friends-error">{settingsError}</p> : null}

            <div className="friends-add-modal-actions">
              <button type="button" onClick={handleSaveSettings}>Save</button>
              <button type="button" className="secondary" onClick={() => setIsSettingsModalOpen(false)}>Close</button>
            </div>
          </div>
        </div>
      ) : null}





    </div>
  );

function FriendsFeature({ onSwitchToClassic }) {
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [authToken, setAuthToken] = useState('');
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState('');
  const [phoneState, setPhoneState] = useState('idle');
  const [confirmationResult, setConfirmationResult] = useState(null);
  const [socket, setSocket] = useState(null);

  const recaptchaRef = useRef(null);

  const refreshProfile = async (token) => {
    const idToken = token || authToken;
    if (!idToken) return;
    const data = await fetchFriendsProfile(idToken);
    setProfile(data.profile);
  };

  useEffect(() => {
    if (!isFirebaseConfigured || !friendsAuth) return undefined;

    const unsub = onAuthStateChanged(friendsAuth, async (nextUser) => {
      setFirebaseUser(nextUser);
      if (!nextUser) {
        setAuthToken('');
        setProfile(null);
        return;
      }
      try {
        const token = await nextUser.getIdToken(true);
        setAuthToken(token);
      } catch (e) {
        setError(e.message || 'Failed to get auth token');
      }
    });

    return () => unsub();
  }, []);

  useEffect(() => {
    if (!authToken) return;
    refreshProfile(authToken).catch((e) => setError(mapFriendsBackendError(e) || 'Profile sync failed'));
  }, [authToken]);

  useEffect(() => {
    if (!authToken) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
      return;
    }

    const nextSocket = io(`${getFriendsBackendUrl()}/friends`, {
      transports: ['websocket', 'polling'],
      auth: { token: authToken }
    });

    nextSocket.on('connect_error', (err) => {
      setError(err?.message || 'Friends socket connection failed');
    });

    // --- Real-time event listeners ---
    // New message (including replies/forwards)
    nextSocket.on('friends:new_message', (payload) => {
      const { message, fromUniqueId, toUniqueId } = payload;
      // Determine which contact this message belongs to
      const contactId = fromUniqueId === profile?.uniqueId ? toUniqueId : fromUniqueId;
      setMessagesByContact((prev) => {
        const current = prev[contactId] || [];
        // Avoid duplicate by id
        if (current.some((m) => m.id === message.id)) return prev;
        return {
          ...prev,
          [contactId]: [...current, { ...message, isMine: fromUniqueId === profile?.uniqueId }].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
        };
      });
    });

    // Message reaction (emoji)
    nextSocket.on('friends:reaction', (payload) => {
      const { messageId, emoji, count, contactId } = payload;
      setMessagesByContact((prev) => {
        const msgs = prev[contactId] || [];
        return {
          ...prev,
          [contactId]: msgs.map((m) => {
            if (m.id !== messageId) return m;
            let newReactions = Array.isArray(m.reactions) ? [...m.reactions] : [];
            const idx = newReactions.findIndex((r) => r.emoji === emoji);
            if (idx >= 0) {
              newReactions[idx] = { ...newReactions[idx], count };
            } else {
              newReactions.push({ emoji, count });
            }
            return { ...m, reactions: newReactions };
          })
        };
      });
    });

    // Forwarded message (handled as new_message, but can add extra logic if needed)
    // If you want to distinguish, add a separate event or check message.forwarded

    // Optionally: message deleted/edited events can be handled here

    setSocket(nextSocket);

    return () => {
      nextSocket.disconnect();
      setSocket(null);
    };
  }, [authToken, profile?.uniqueId]);

  const handleGoogleLogin = async () => {
    if (!friendsAuth) {
      setError('Firebase auth is not initialized. Restart frontend and check Firebase config.');
      return;
    }
    setError('');
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(friendsAuth, provider);
    } catch (e) {
      const code = e?.code || '';
      const shouldUseRedirect = code === 'auth/popup-blocked' || code === 'auth/cancelled-popup-request';

      if (shouldUseRedirect) {
        try {
          await signInWithRedirect(friendsAuth, provider);
          return;
        } catch (redirectError) {
          setError(mapFirebaseAuthError(redirectError));
          return;
        }
      }

      setError(mapFirebaseAuthError(e));
    }
  };

  useEffect(() => {
    if (!friendsAuth) return;

    getRedirectResult(friendsAuth).catch((e) => {
      const code = e?.code || '';
      if (code === 'auth/no-auth-event') return;
      setError(mapFirebaseAuthError(e));
    });
  }, []);

  const handlePhoneStart = async (phone) => {
    if (!friendsAuth) {
      setError('Firebase auth is not initialized. Restart frontend and check Firebase config.');
      return;
    }
    setError('');
    try {
      setPhoneState('sending');
      if (!recaptchaRef.current) {
        recaptchaRef.current = new RecaptchaVerifier(friendsAuth, 'friends-recaptcha-container', {
          size: 'normal'
        });
      }

      const confirmation = await signInWithPhoneNumber(friendsAuth, phone, recaptchaRef.current);
      setConfirmationResult(confirmation);
      setPhoneState('code-sent');
    } catch (e) {
      setPhoneState('idle');
      setError(mapFirebaseAuthError(e));
    }
  };

  const handlePhoneConfirm = async (code) => {
    setError('');
    if (!confirmationResult) {
      setError('Send OTP first.');
      return;
    }
    try {
      await confirmationResult.confirm(code);
      setPhoneState('verified');
    } catch (e) {
      setError(mapFirebaseAuthError(e));
    }
  };

  const handleLogout = async () => {
    setError('');
    try {
      if (friendsAuth) await signOut(friendsAuth);
      setProfile(null);
      setFirebaseUser(null);
      setAuthToken('');
      if (recaptchaRef.current) {
        recaptchaRef.current.clear();
        recaptchaRef.current = null;
      }
    } catch (e) {
      setError(e.message || 'Logout failed');
    }
  };

  if (!isFirebaseConfigured) {
    return (
      <div className="friends-login">
        <div className="friends-mode-toggle" role="tablist" aria-label="Choose login mode">
          <button
            type="button"
            role="tab"
            className="friends-mode-btn"
            onClick={onSwitchToClassic}
            disabled={!onSwitchToClassic}
          >
            Username + Room
          </button>
          <button type="button" role="tab" aria-selected="true" className="friends-mode-btn active" disabled>
            Friends Login
          </button>
        </div>

        <h3 className="friends-title">Friends Login</h3>
        <p className="friends-error">Missing Firebase client configuration in frontend env.</p>
      </div>
    );
  }

  if (!firebaseUser || !profile) {
    return (
      <LoginPanel
        onGoogleLogin={handleGoogleLogin}
        onPhoneStart={handlePhoneStart}
        onPhoneConfirm={handlePhoneConfirm}
        phoneState={phoneState}
        error={error}
        onSwitchToClassic={onSwitchToClassic}
      />
    );
  }

  return (
    <FriendsWorkspace
      authToken={authToken}
      profile={profile}
      onLogout={handleLogout}
      socket={socket}
      onProfileRefresh={() => refreshProfile()}
    />
  );
}

export default FriendsFeature;
