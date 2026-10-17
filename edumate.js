/* Các khóa lưu trữ riêng giúp dữ liệu Edumate không ảnh hưởng ứng dụng khác. */
const STORAGE_KEYS = {
  tasks: 'edumate.tasks.v1',
  cards: 'edumate.flashcards.v1',
  notes: 'edumate.notes.v1',
  chat: 'edumate.chat.v1'
};

const defaultCards = [
  { front: 'Hello', back: 'Xin chào' },
  { front: 'H₂O là công thức hóa học của chất nào?', back: 'Nước' }
];

let tasks = loadData(STORAGE_KEYS.tasks, []);
let cards = loadData(STORAGE_KEYS.cards, defaultCards);
let cardIndex = 0;
let timerMode = 'study';
let timerSeconds = 25 * 60;
let timerDuration = timerSeconds;
let timerInterval = null;
let toastTimeout = null;

const timerDisplay = document.getElementById('timerDisplay');
const timerCaption = document.getElementById('timerCaption');
const timerProgress = document.getElementById('timerProgress');
const timerFace = document.getElementById('timerFace');
const startButton = document.getElementById('startButton');
const flashcard = document.getElementById('flashcard');

/* Đọc LocalStorage an toàn và báo rõ nếu trình duyệt chặn quyền lưu trữ. */
function loadData(key, fallback) {
  try {
    const saved = localStorage.getItem(key);
    if (saved === null) return structuredClone(fallback);
    const parsed = JSON.parse(saved);
    return Array.isArray(fallback) && !Array.isArray(parsed) ? structuredClone(fallback) : parsed;
  } catch (error) {
    console.error(`Không thể đọc dữ liệu Edumate (${key}):`, error);
    showToast('Không thể đọc dữ liệu đã lưu. Hãy kiểm tra quyền LocalStorage của trình duyệt.', true);
    return structuredClone(fallback);
  }
}

function saveData(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.error(`Không thể lưu dữ liệu Edumate (${key}):`, error);
    showToast('Không thể lưu dữ liệu. Hãy kiểm tra dung lượng hoặc quyền lưu trữ của trình duyệt.', true);
    return false;
  }
}

function showToast(message, isError = false) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.toggle('error', isError);
  toast.classList.add('show');
  window.clearTimeout(toastTimeout);
  toastTimeout = window.setTimeout(() => toast.classList.remove('show'), 3200);
}

/* Hiển thị ngày hiện tại theo ngôn ngữ tiếng Việt. */
document.getElementById('todayLabel').textContent = new Intl.DateTimeFormat('vi-VN', {
  weekday: 'long', day: 'numeric', month: 'long'
}).format(new Date());

/* Đồng hồ Pomodoro: 25 phút học, 5 phút nghỉ; có thể tạm dừng và đặt lại. */
function updateTimer() {
  const minutes = Math.floor(timerSeconds / 60).toString().padStart(2, '0');
  const seconds = (timerSeconds % 60).toString().padStart(2, '0');
  timerDisplay.textContent = `${minutes}:${seconds}`;
  const progress = timerDuration === 0 ? 0 : timerSeconds / timerDuration;
  timerProgress.style.strokeDashoffset = `${622.04 * (1 - progress)}`;
}

function setTimerMode(mode) {
  if (timerInterval) window.clearInterval(timerInterval);
  timerInterval = null;
  timerMode = mode;
  timerDuration = mode === 'study' ? 25 * 60 : 5 * 60;
  timerSeconds = timerDuration;
  document.querySelectorAll('.timer-tab').forEach((tab) => {
    const isActive = tab.dataset.mode === mode;
    tab.classList.toggle('active', isActive);
    tab.setAttribute('aria-pressed', String(isActive));
  });
  timerFace.classList.toggle('break-mode', mode === 'break');
  startButton.innerHTML = '<span aria-hidden="true">▶</span> Bắt đầu';
  startButton.setAttribute('aria-label', 'Bắt đầu đồng hồ');
  timerCaption.textContent = 'Sẵn sàng bắt đầu';
  updateTimer();
}

function playCompletionSound() {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) throw new Error('Trình duyệt không hỗ trợ âm thanh Web Audio.');
    const context = new AudioContextClass();
    [0, 0.24, 0.48].forEach((delay, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = [660, 784, 988][index];
      gain.gain.setValueAtTime(0.0001, context.currentTime + delay);
      gain.gain.exponentialRampToValueAtTime(0.18, context.currentTime + delay + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + delay + 0.2);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(context.currentTime + delay);
      oscillator.stop(context.currentTime + delay + 0.22);
    });
    window.setTimeout(() => context.close(), 900);
  } catch (error) {
    console.warn('Không phát được âm báo:', error);
    showToast('Đã hết giờ! (Trình duyệt không phát được âm thanh.)');
  }
}

function notifyTimerComplete() {
  playCompletionSound();
  const message = timerMode === 'study' ? 'Phiên học đã kết thúc. Đến giờ nghỉ ngơi rồi!' : 'Đã hết giờ nghỉ. Sẵn sàng học tiếp nhé!';
  showToast(message);
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification('Edumate · Đã hết giờ', { body: message, icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="18" fill="%237968dd"/><text x="50%" y="55%" text-anchor="middle" font-size="42" fill="white" font-family="Arial">e</text></svg>' });
  }
  timerCaption.textContent = 'Đã hoàn thành! 🎉';
  startButton.innerHTML = '<span aria-hidden="true">▶</span> Bắt đầu';
  startButton.setAttribute('aria-label', 'Bắt đầu đồng hồ');
}

startButton.addEventListener('click', () => {
  if (timerInterval) {
    window.clearInterval(timerInterval);
    timerInterval = null;
    startButton.innerHTML = '<span aria-hidden="true">▶</span> Tiếp tục';
    startButton.setAttribute('aria-label', 'Tiếp tục đồng hồ');
    timerCaption.textContent = 'Đang tạm dừng';
    return;
  }
  if (timerSeconds === 0) setTimerMode(timerMode);
  startButton.innerHTML = '<span aria-hidden="true">Ⅱ</span> Tạm dừng';
  startButton.setAttribute('aria-label', 'Tạm dừng đồng hồ');
  timerCaption.textContent = timerMode === 'study' ? 'Đang tập trung...' : 'Đang nghỉ ngơi...';
  timerInterval = window.setInterval(() => {
    timerSeconds -= 1;
    updateTimer();
    if (timerSeconds <= 0) {
      window.clearInterval(timerInterval);
      timerInterval = null;
      notifyTimerComplete();
    }
  }, 1000);
});

document.getElementById('resetButton').addEventListener('click', () => {
  setTimerMode(timerMode);
});
document.querySelectorAll('.timer-tab').forEach((tab) => {
  tab.addEventListener('click', () => setTimerMode(tab.dataset.mode));
});
document.getElementById('notificationButton').addEventListener('click', async () => {
  if (!('Notification' in window)) {
    showToast('Trình duyệt này không hỗ trợ thông báo.');
    return;
  }
  if (Notification.permission === 'granted') {
    showToast('Thông báo đã được bật cho Edumate.');
    return;
  }
  if (Notification.permission === 'denied') {
    showToast('Thông báo đang bị chặn. Hãy bật quyền trong cài đặt trình duyệt.', true);
    return;
  }
  const permission = await Notification.requestPermission();
  showToast(permission === 'granted' ? 'Đã bật thông báo khi hết giờ!' : 'Bạn chưa cấp quyền thông báo.');
});

/* Danh sách bài tập: thao tác thêm, hoàn thành, xóa đều được lưu lại. */
const taskList = document.getElementById('taskList');
const taskEmpty = document.getElementById('taskEmpty');

function renderTasks() {
  taskList.replaceChildren();
  const sortedTasks = [...tasks].sort((a, b) => Number(a.completed) - Number(b.completed));
  sortedTasks.forEach((task) => {
    const row = document.createElement('div');
    row.className = `task-item${task.completed ? ' completed' : ''}`;
    const checkbox = document.createElement('input');
    checkbox.className = 'task-check';
    checkbox.type = 'checkbox';
    checkbox.checked = task.completed;
    checkbox.setAttribute('aria-label', `Đánh dấu hoàn thành: ${task.title}`);
    checkbox.addEventListener('change', () => {
      task.completed = checkbox.checked;
      saveData(STORAGE_KEYS.tasks, tasks);
      renderTasks();
    });

    const info = document.createElement('span');
    info.className = 'task-info';
    const title = document.createElement('span');
    title.className = 'task-title';
    title.textContent = task.title;
    const meta = document.createElement('span');
    meta.className = 'task-meta';
    const dueText = task.due ? ` · Hạn ${new Intl.DateTimeFormat('vi-VN', { day: 'numeric', month: 'numeric' }).format(new Date(`${task.due}T00:00:00`))}` : '';
    meta.textContent = `${task.subject}${dueText}`;
    info.append(title, meta);

    const remove = document.createElement('button');
    remove.className = 'task-delete';
    remove.type = 'button';
    remove.textContent = '×';
    remove.setAttribute('aria-label', `Xóa nhiệm vụ: ${task.title}`);
    remove.addEventListener('click', () => {
      tasks = tasks.filter((item) => item.id !== task.id);
      saveData(STORAGE_KEYS.tasks, tasks);
      renderTasks();
    });
    row.append(checkbox, info, remove);
    taskList.append(row);
  });
  taskEmpty.hidden = tasks.length > 0;
  document.getElementById('taskCount').textContent = `${tasks.filter((task) => !task.completed).length} việc`;
}

document.getElementById('taskForm').addEventListener('submit', (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const formData = new FormData(form);
  const title = String(formData.get('title') || '').trim();
  if (!title) {
    showToast('Vui lòng nhập tên bài tập hoặc nhiệm vụ.', true);
    return;
  }
  tasks.unshift({
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    title,
    subject: String(formData.get('subject') || 'Khác'),
    due: String(formData.get('due') || ''),
    completed: false
  });
  saveData(STORAGE_KEYS.tasks, tasks);
  form.reset();
  renderTasks();
  document.getElementById('taskTitle').focus();
});

/* Flashcard có thể lật 3D và điều hướng qua lại giữa các thẻ đã tạo. */
function renderCard() {
  flashcard.classList.remove('is-flipped');
  flashcard.setAttribute('aria-pressed', 'false');
  const hasCards = cards.length > 0;
  document.getElementById('cardFrontText').textContent = hasCards ? cards[cardIndex].front : 'Tạo thẻ đầu tiên của bạn';
  document.getElementById('cardBackText').textContent = hasCards ? cards[cardIndex].back : 'Đáp án sẽ hiện ở đây';
  document.getElementById('cardPosition').textContent = `${hasCards ? cardIndex + 1 : 0} / ${cards.length}`;
  document.getElementById('cardCount').textContent = `${cards.length} thẻ`;
  document.getElementById('deleteCard').disabled = !hasCards;
  document.getElementById('previousCard').disabled = !hasCards;
  document.getElementById('nextCard').disabled = !hasCards;
}

flashcard.addEventListener('click', () => {
  if (!cards.length) return;
  const isFlipped = flashcard.classList.toggle('is-flipped');
  flashcard.setAttribute('aria-pressed', String(isFlipped));
});
document.getElementById('previousCard').addEventListener('click', () => {
  if (!cards.length) return;
  cardIndex = (cardIndex - 1 + cards.length) % cards.length;
  renderCard();
});
document.getElementById('nextCard').addEventListener('click', () => {
  if (!cards.length) return;
  cardIndex = (cardIndex + 1) % cards.length;
  renderCard();
});
document.getElementById('deleteCard').addEventListener('click', () => {
  if (!cards.length) return;
  cards.splice(cardIndex, 1);
  cardIndex = cards.length ? cardIndex % cards.length : 0;
  saveData(STORAGE_KEYS.cards, cards);
  renderCard();
  showToast('Đã xóa thẻ ghi nhớ.');
});
document.getElementById('flashcardForm').addEventListener('submit', (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const formData = new FormData(form);
  const front = String(formData.get('front') || '').trim();
  const back = String(formData.get('back') || '').trim();
  if (!front || !back) {
    showToast('Vui lòng điền cả mặt trước và mặt sau của thẻ.', true);
    return;
  }
  cards.push({ front, back });
  cardIndex = cards.length - 1;
  saveData(STORAGE_KEYS.cards, cards);
  form.reset();
  renderCard();
  document.getElementById('flashFront').focus();
});

/* Ghi chú tự lưu sau mỗi lần nhập, có thông báo trạng thái lưu. */
const notesField = document.getElementById('quickNotes');
const notesStatus = document.getElementById('notesStatus');
let notesSaveTimeout = null;
notesField.value = loadData(STORAGE_KEYS.notes, '');
document.getElementById('notesLength').textContent = `${notesField.value.length} / 3000`;
notesField.addEventListener('input', () => {
  document.getElementById('notesLength').textContent = `${notesField.value.length} / 3000`;
  notesStatus.textContent = 'Đang lưu...';
  window.clearTimeout(notesSaveTimeout);
  notesSaveTimeout = window.setTimeout(() => {
    if (saveData(STORAGE_KEYS.notes, notesField.value)) {
      notesStatus.textContent = 'Đã lưu ghi chú';
    } else {
      notesStatus.textContent = 'Chưa lưu được ghi chú';
    }
  }, 350);
});

/* Cuộc trò chuyện được lưu cục bộ; ảnh chỉ xem tạm và không gửi tới dịch vụ bên ngoài. */
const storedChat = loadData(STORAGE_KEYS.chat, { conversations: [], activeConversationId: null, selectedTopic: 'Chung' });
let conversations = Array.isArray(storedChat?.conversations) ? storedChat.conversations : [];
let activeConversationId = typeof storedChat?.activeConversationId === 'string' ? storedChat.activeConversationId : null;
let selectedTopic = typeof storedChat?.selectedTopic === 'string' ? storedChat.selectedTopic : 'Chung';
let pendingImages = [];
const imagePreviews = new Map();
const chatThread = document.getElementById('chatThread');
const chatInput = document.getElementById('chatInput');
const chatImageInput = document.getElementById('chatImageInput');
const chatSendButton = document.getElementById('sendChatButton');

function saveChatState() {
  return saveData(STORAGE_KEYS.chat, { conversations, activeConversationId, selectedTopic });
}

function activeConversation() {
  return conversations.find((conversation) => conversation.id === activeConversationId) || null;
}

function createConversation(topic = selectedTopic) {
  const conversation = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    topic,
    title: topic === 'Chung' ? 'Cuộc trò chuyện mới' : `Cuộc trò chuyện mới · ${topic}`,
    createdAt: new Date().toISOString(),
    messages: []
  };
  conversations.unshift(conversation);
  activeConversationId = conversation.id;
  selectedTopic = topic;
  saveChatState();
  renderChat();
}

function formatChatTime(timestamp) {
  return new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit' }).format(new Date(timestamp));
}

function renderHistory() {
  const historyList = document.getElementById('historyList');
  const historyEmpty = document.getElementById('historyEmpty');
  historyList.replaceChildren();
  const sorted = [...conversations].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  sorted.forEach((conversation) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `history-item${conversation.id === activeConversationId ? ' active' : ''}`;
    button.setAttribute('aria-current', conversation.id === activeConversationId ? 'true' : 'false');
    const title = document.createElement('span');
    title.textContent = conversation.title;
    button.append(title);
    button.addEventListener('click', () => {
      activeConversationId = conversation.id;
      selectedTopic = conversation.topic || 'Chung';
      saveChatState();
      renderChat();
    });
    historyList.append(button);
  });
  historyEmpty.hidden = conversations.length > 0;
  document.getElementById('historyCount').textContent = String(conversations.length);
}

function renderMessage(message) {
  const row = document.createElement('article');
  row.className = `chat-message${message.role === 'user' ? ' user-message' : ''}`;
  const avatar = document.createElement('span');
  avatar.className = 'message-avatar';
  avatar.setAttribute('aria-hidden', 'true');
  avatar.textContent = message.role === 'user' ? 'H' : '✦';

  const content = document.createElement('div');
  content.className = 'message-content';
  const bubble = document.createElement('div');
  bubble.className = 'message-bubble';
  bubble.textContent = message.text;
  content.append(bubble);

  (message.attachments || []).forEach((attachment) => {
    const item = document.createElement('div');
    item.className = 'message-attachment';
    const previewUrl = imagePreviews.get(`${activeConversationId}:${message.id}:${attachment.name}`);
    if (previewUrl) {
      const image = document.createElement('img');
      image.src = previewUrl;
      image.alt = `Ảnh bài tập: ${attachment.name}`;
      item.append(image);
    } else {
      const icon = document.createElement('span');
      icon.setAttribute('aria-hidden', 'true');
      icon.textContent = '🖼️';
      item.append(icon);
    }
    const name = document.createElement('span');
    name.textContent = attachment.name;
    item.append(name);
    content.append(item);
  });

  const time = document.createElement('time');
  time.className = 'message-time';
  time.dateTime = message.createdAt;
  time.textContent = formatChatTime(message.createdAt);
  content.append(time);
  row.append(avatar, content);
  return row;
}

function renderChat() {
  const conversation = activeConversation();
  document.getElementById('chatTitle').textContent = 'Người bạn đồng hành';
  document.getElementById('chatTopicBadge').textContent = conversation?.topic || selectedTopic;
  document.querySelectorAll('.topic-button').forEach((button) => {
    const isActive = button.dataset.topic === (conversation?.topic || selectedTopic);
    button.classList.toggle('active', isActive);
    button.setAttribute('aria-pressed', String(isActive));
  });
  chatThread.replaceChildren();
  if (!conversation || !conversation.messages.length) {
    const welcome = document.createElement('div');
    welcome.className = 'chat-welcome';
    const sparkle = document.createElement('div');
    sparkle.className = 'welcome-sparkle';
    sparkle.setAttribute('aria-hidden', 'true');
    sparkle.textContent = '✦';
    const title = document.createElement('h2');
    title.textContent = conversation?.topic && conversation.topic !== 'Chung'
      ? `Cùng học ${conversation.topic} nhé!`
      : 'Học cùng nhau nhé!';
    const copy = document.createElement('p');
    copy.textContent = 'Hỏi bài, ôn tập hoặc chia sẻ điều bạn đang thắc mắc. Mình sẽ đồng hành cùng bạn.';
    welcome.append(sparkle, title, copy);
    chatThread.append(welcome);
  } else {
    conversation.messages.forEach((message) => chatThread.append(renderMessage(message)));
    chatThread.scrollTop = chatThread.scrollHeight;
  }
  renderHistory();
}

function renderPendingImages() {
  const list = document.getElementById('attachmentList');
  list.replaceChildren();
  pendingImages.forEach((entry, index) => {
    const chip = document.createElement('div');
    chip.className = 'attachment-chip';
    const image = document.createElement('img');
    image.src = entry.previewUrl;
    image.alt = '';
    const name = document.createElement('span');
    name.textContent = entry.file.name;
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.setAttribute('aria-label', `Bỏ ảnh ${entry.file.name}`);
    remove.textContent = '×';
    remove.addEventListener('click', () => {
      URL.revokeObjectURL(entry.previewUrl);
      pendingImages.splice(index, 1);
      renderPendingImages();
      updateChatSendButton();
    });
    chip.append(image, name, remove);
    list.append(chip);
  });
}

function updateChatSendButton() {
  chatSendButton.disabled = !chatInput.value.trim() && pendingImages.length === 0;
}

document.querySelectorAll('[data-view]').forEach((button) => {
  button.addEventListener('click', () => {
    const selectedView = button.dataset.view;
    document.querySelector('.welcome-row').hidden = selectedView !== 'dashboard';
    document.querySelector('.dashboard-grid').hidden = selectedView !== 'dashboard';
    document.getElementById('companionView').hidden = selectedView !== 'companion';
    document.getElementById('quizView').hidden = selectedView !== 'quiz';
    document.querySelectorAll('[data-view]').forEach((navButton) => {
      const isActive = navButton === button;
      navButton.classList.toggle('active', isActive);
      navButton.setAttribute('aria-current', isActive ? 'page' : 'false');
    });
    if (selectedView === 'companion') chatInput.focus();
  });
});

document.getElementById('newChatButton').addEventListener('click', () => createConversation());
document.querySelectorAll('.topic-button').forEach((button) => {
  button.addEventListener('click', () => {
    selectedTopic = button.dataset.topic;
    createConversation(selectedTopic);
  });
});

document.querySelectorAll('.prompt-chip').forEach((button) => {
  button.addEventListener('click', () => {
    chatInput.value = button.dataset.prompt;
    updateChatSendButton();
    chatInput.focus();
    chatInput.setSelectionRange(chatInput.value.length, chatInput.value.length);
  });
});

chatInput.addEventListener('input', () => {
  chatInput.style.height = 'auto';
  chatInput.style.height = `${Math.min(chatInput.scrollHeight, 112)}px`;
  updateChatSendButton();
});
chatInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    if (!chatSendButton.disabled) document.getElementById('chatForm').requestSubmit();
  }
});

document.getElementById('uploadImageButton').addEventListener('click', () => chatImageInput.click());
chatImageInput.addEventListener('change', () => {
  Array.from(chatImageInput.files || []).forEach((file) => {
    if (!file.type.startsWith('image/')) {
      showToast(`Tệp "${file.name}" không phải hình ảnh.`, true);
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      showToast(`Ảnh "${file.name}" vượt quá giới hạn 8 MB.`, true);
      return;
    }
    if (pendingImages.length >= 4) {
      showToast('Mỗi tin nhắn có thể đính kèm tối đa 4 hình ảnh.', true);
      return;
    }
    pendingImages.push({ file, previewUrl: URL.createObjectURL(file) });
  });
  chatImageInput.value = '';
  renderPendingImages();
  updateChatSendButton();
});

document.getElementById('chatForm').addEventListener('submit', (event) => {
  event.preventDefault();
  const text = chatInput.value.trim();
  if (!text && !pendingImages.length) return;
  if (!activeConversation()) createConversation(selectedTopic);
  const conversation = activeConversation();
  const now = new Date().toISOString();
  const messageId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const userMessage = {
    id: messageId,
    role: 'user',
    text: text || 'Mình gửi hình ảnh bài tập này, bạn xem giúp mình nhé.',
    createdAt: now,
    attachments: pendingImages.map(({ file, previewUrl }) => {
      imagePreviews.set(`${conversation.id}:${messageId}:${file.name}`, previewUrl);
      return { name: file.name, type: file.type };
    })
  };
  conversation.messages.push(userMessage);
  if (conversation.messages.filter((message) => message.role === 'user').length === 1 && text) {
    conversation.title = text.length > 38 ? `${text.slice(0, 38).trim()}…` : text;
  }
  conversation.messages.push({
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    role: 'assistant',
    text: 'Mình đã nhận được câu hỏi của bạn. Hiện Edumate chưa kết nối dịch vụ AI nên chưa thể phân tích câu hỏi hoặc hình ảnh và tạo lời giải. Nội dung hội thoại được lưu trên thiết bị này; câu hỏi và ảnh chưa được gửi tới máy chủ.',
    createdAt: new Date().toISOString(),
    attachments: []
  });
  pendingImages = [];
  chatInput.value = '';
  chatInput.style.height = 'auto';
  renderPendingImages();
  saveChatState();
  renderChat();
  updateChatSendButton();
  chatInput.focus();
});

window.addEventListener('pagehide', () => {
  pendingImages.forEach(({ previewUrl }) => URL.revokeObjectURL(previewUrl));
  imagePreviews.forEach((previewUrl) => URL.revokeObjectURL(previewUrl));
});

/* Ngân hàng câu hỏi mẫu: mỗi môn có 5 câu, 4 lựa chọn và giải thích đáp án. */
const quizQuestionBank = {
  'Toán': [
    { question: 'Nghiệm của phương trình 2x + 5 = 13 là gì?', options: ['x = 3', 'x = 4', 'x = 5', 'x = 9'], answer: 1, explanation: 'Trừ 5 hai vế được 2x = 8. Chia hai vế cho 2, ta có x = 4.' },
    { question: 'Diện tích hình tròn bán kính r được tính theo công thức nào?', options: ['2πr', 'πr²', 'πd', 'r² / 2'], answer: 1, explanation: 'Diện tích hình tròn bằng π nhân với bình phương bán kính: S = πr².' },
    { question: 'Kết quả của (a + b)² là gì?', options: ['a² + b²', 'a² − 2ab + b²', 'a² + 2ab + b²', '2a + 2b'], answer: 2, explanation: 'Theo hằng đẳng thức bình phương một tổng: (a + b)² = a² + 2ab + b².' },
    { question: 'Một tam giác có hai góc 50° và 60°. Góc còn lại bằng bao nhiêu?', options: ['60°', '70°', '80°', '90°'], answer: 1, explanation: 'Tổng ba góc trong một tam giác là 180°. Góc còn lại là 180° − 50° − 60° = 70°.' },
    { question: 'Giá trị trung bình cộng của 4, 6, 8 và 10 là bao nhiêu?', options: ['6', '7', '8', '9'], answer: 1, explanation: 'Cộng các số rồi chia cho số lượng: (4 + 6 + 8 + 10) / 4 = 7.' }
  ],
  'Lý': [
    { question: 'Đơn vị đo cường độ dòng điện trong hệ SI là gì?', options: ['Vôn (V)', 'Ampe (A)', 'Oát (W)', 'Jun (J)'], answer: 1, explanation: 'Cường độ dòng điện được đo bằng ampe, ký hiệu A.' },
    { question: 'Một vật đi được 120 m trong 20 giây. Tốc độ trung bình là bao nhiêu?', options: ['4 m/s', '5 m/s', '6 m/s', '8 m/s'], answer: 2, explanation: 'Tốc độ trung bình v = s / t = 120 / 20 = 6 m/s.' },
    { question: 'Theo định luật Ôm, cường độ dòng điện được tính bằng công thức nào?', options: ['I = U / R', 'I = U × R', 'I = R / U', 'I = P × U'], answer: 0, explanation: 'Định luật Ôm cho đoạn mạch: I = U / R, trong đó U là hiệu điện thế và R là điện trở.' },
    { question: 'Âm thanh truyền được trong môi trường nào?', options: ['Chỉ trong chân không', 'Chỉ trong chất khí', 'Trong chất rắn, lỏng và khí', 'Trong mọi môi trường, kể cả chân không'], answer: 2, explanation: 'Âm cần môi trường vật chất để truyền, có thể truyền qua chất rắn, chất lỏng và chất khí; âm không truyền trong chân không.' },
    { question: 'Lực nào giữ các vật gần mặt đất?', options: ['Lực đàn hồi', 'Lực hấp dẫn của Trái Đất', 'Lực ma sát', 'Lực đẩy Ác-si-mét'], answer: 1, explanation: 'Trái Đất hút các vật về phía mình bằng lực hấp dẫn, thường gọi là trọng lực gần mặt đất.' }
  ],
  'Hóa': [
    { question: 'Ký hiệu hóa học của nguyên tố oxi là gì?', options: ['Ox', 'O', 'Og', 'Oi'], answer: 1, explanation: 'Ký hiệu hóa học của nguyên tố oxi là O. O₂ là công thức phân tử của khí oxi.' },
    { question: 'Dung dịch có pH nhỏ hơn 7 thường có tính chất gì?', options: ['Có tính axit', 'Có tính bazơ', 'Trung tính', 'Không thể xác định'], answer: 0, explanation: 'Ở điều kiện thông thường, pH < 7 biểu thị môi trường axit; pH = 7 trung tính và pH > 7 có tính bazơ.' },
    { question: 'Công thức hóa học của nước là gì?', options: ['HO', 'H₂O', 'H₂O₂', 'OH₂O'], answer: 1, explanation: 'Một phân tử nước gồm hai nguyên tử hiđro và một nguyên tử oxi, có công thức H₂O.' },
    { question: 'Chất nào sau đây là khí hiếm?', options: ['Oxi', 'Nitơ', 'Heli', 'Hiđro'], answer: 2, explanation: 'Heli (He) thuộc nhóm khí hiếm trong bảng tuần hoàn.' },
    { question: 'Trong phản ứng hóa học, tổng khối lượng các chất được bảo toàn theo định luật nào?', options: ['Định luật bảo toàn năng lượng', 'Định luật bảo toàn khối lượng', 'Định luật Ôm', 'Định luật vạn vật hấp dẫn'], answer: 1, explanation: 'Định luật bảo toàn khối lượng: tổng khối lượng các chất tham gia phản ứng bằng tổng khối lượng các sản phẩm.' }
  ],
  'Tiếng Anh': [
    { question: 'Choose the correct form: “She ___ to school every day.”', options: ['go', 'goes', 'going', 'gone'], answer: 1, explanation: 'Ở thì hiện tại đơn, chủ ngữ ngôi thứ ba số ít “She” đi với động từ thêm -s/-es: “goes”.' },
    { question: 'What is the past tense of “write”?', options: ['writed', 'written', 'wrote', 'writing'], answer: 2, explanation: '“Write” là động từ bất quy tắc; dạng quá khứ đơn là “wrote”, còn quá khứ phân từ là “written”.' },
    { question: 'Choose the correct article: “He is ___ honest student.”', options: ['a', 'an', 'the', 'no article'], answer: 1, explanation: '“Honest” bắt đầu bằng âm nguyên âm /ɒ/ vì h câm, nên dùng mạo từ “an”.' },
    { question: 'Which word is closest in meaning to “begin”?', options: ['finish', 'start', 'forget', 'follow'], answer: 1, explanation: '“Begin” và “start” đều có nghĩa là bắt đầu.' },
    { question: 'Choose the correct comparative: “This book is ___ than that one.”', options: ['interesting', 'more interesting', 'most interesting', 'the interesting'], answer: 1, explanation: 'Tính từ dài “interesting” dùng “more” để tạo dạng so sánh hơn: “more interesting”.' }
  ],
  'Lịch Sử': [
    { question: 'Ngày Quốc khánh nước Việt Nam hiện nay là ngày nào?', options: ['30/4', '1/5', '2/9', '19/8'], answer: 2, explanation: 'Ngày 2 tháng 9 năm 1945, Chủ tịch Hồ Chí Minh đọc Tuyên ngôn Độc lập; ngày này là Quốc khánh Việt Nam.' },
    { question: 'Chiến thắng Bạch Đằng năm 938 gắn với vị tướng nào?', options: ['Trần Hưng Đạo', 'Ngô Quyền', 'Lý Thường Kiệt', 'Quang Trung'], answer: 1, explanation: 'Ngô Quyền lãnh đạo chiến thắng Bạch Đằng năm 938, chấm dứt hơn một nghìn năm Bắc thuộc.' },
    { question: 'Triều đại nào gắn với việc dời đô từ Hoa Lư ra Thăng Long năm 1010?', options: ['Nhà Đinh', 'Nhà Tiền Lê', 'Nhà Lý', 'Nhà Trần'], answer: 2, explanation: 'Năm 1010, vua Lý Thái Tổ ban Chiếu dời đô, chuyển kinh đô từ Hoa Lư ra Đại La và đổi tên thành Thăng Long.' },
    { question: 'Ai là người lãnh đạo cuộc khởi nghĩa Lam Sơn?', options: ['Lê Lợi', 'Trần Quốc Tuấn', 'Nguyễn Huệ', 'Đinh Bộ Lĩnh'], answer: 0, explanation: 'Lê Lợi lãnh đạo khởi nghĩa Lam Sơn (1418–1427), giành thắng lợi và lập ra triều Hậu Lê.' },
    { question: 'Chiến thắng Điện Biên Phủ diễn ra vào năm nào?', options: ['1945', '1950', '1954', '1975'], answer: 2, explanation: 'Chiến dịch Điện Biên Phủ kết thúc thắng lợi ngày 7/5/1954, góp phần chấm dứt chiến tranh Đông Dương của Pháp.' }
  ],
  'Khoa học': [
    { question: 'Cơ quan nào bơm máu đi khắp cơ thể người?', options: ['Phổi', 'Gan', 'Tim', 'Thận'], answer: 2, explanation: 'Tim co bóp nhịp nhàng để bơm máu qua hệ mạch đến các cơ quan và mô trong cơ thể.' },
    { question: 'Thực vật chủ yếu hấp thụ nước và muối khoáng qua bộ phận nào?', options: ['Hoa', 'Rễ', 'Quả', 'Lá'], answer: 1, explanation: 'Rễ, đặc biệt là miền lông hút, hấp thụ phần lớn nước và muối khoáng từ đất.' },
    { question: 'Hành tinh nào gần Mặt Trời nhất?', options: ['Sao Kim', 'Trái Đất', 'Sao Hỏa', 'Sao Thủy'], answer: 3, explanation: 'Sao Thủy là hành tinh nằm gần Mặt Trời nhất trong Hệ Mặt Trời.' },
    { question: 'Quá trình thực vật dùng ánh sáng để tạo chất dinh dưỡng gọi là gì?', options: ['Hô hấp', 'Quang hợp', 'Bay hơi', 'Lên men'], answer: 1, explanation: 'Trong quang hợp, thực vật sử dụng năng lượng ánh sáng, nước và khí carbon dioxide để tạo chất hữu cơ và giải phóng oxygen.' },
    { question: 'Ở áp suất khí quyển tiêu chuẩn, nước tinh khiết sôi ở nhiệt độ nào?', options: ['0°C', '50°C', '100°C', '150°C'], answer: 2, explanation: 'Ở áp suất khí quyển tiêu chuẩn, nước tinh khiết sôi ở 100°C.' }
  ]
};

const extraQuizQuestions = {
  'Toán': [
    { question: 'Nếu 3x − 7 = 11 thì x bằng bao nhiêu?', options: ['4', '5', '6', '7'], answer: 2, explanation: 'Cộng 7 vào hai vế được 3x = 18. Chia hai vế cho 3, suy ra x = 6.' },
    { question: 'Phân số nào bằng 3/4?', options: ['6/8', '6/10', '8/6', '9/16'], answer: 0, explanation: 'Nhân cả tử số và mẫu số của 3/4 với 2 được 6/8, nên hai phân số bằng nhau.' },
    { question: 'Chu vi hình vuông cạnh 5 cm là bao nhiêu?', options: ['10 cm', '20 cm', '25 cm', '15 cm'], answer: 1, explanation: 'Chu vi hình vuông bằng 4 lần độ dài cạnh: 4 × 5 = 20 cm.' },
    { question: 'Số nào là số nguyên tố?', options: ['21', '27', '29', '33'], answer: 2, explanation: '29 chỉ chia hết cho 1 và chính nó. Các số 21, 27 và 33 đều có ước khác 1 và chính nó.' },
    { question: 'Một góc vuông có số đo bao nhiêu độ?', options: ['45°', '90°', '120°', '180°'], answer: 1, explanation: 'Theo định nghĩa, góc vuông có số đo bằng 90°.' }
  ],
  'Lý': [
    { question: 'Đơn vị đo hiệu điện thế là gì?', options: ['Ampe (A)', 'Vôn (V)', 'Ôm (Ω)', 'Mét (m)'], answer: 1, explanation: 'Hiệu điện thế được đo bằng vôn, ký hiệu V.' },
    { question: 'Ánh sáng truyền trong chân không với tốc độ gần bằng bao nhiêu?', options: ['300 km/s', '3.000 km/s', '30.000 km/s', '300.000 km/s'], answer: 3, explanation: 'Tốc độ ánh sáng trong chân không xấp xỉ 300.000 km/s, tức khoảng 3 × 10⁸ m/s.' },
    { question: 'Dụng cụ nào dùng để đo nhiệt độ?', options: ['Lực kế', 'Nhiệt kế', 'Ampe kế', 'Thước đo'], answer: 1, explanation: 'Nhiệt kế là dụng cụ dùng để đo nhiệt độ.' },
    { question: 'Khi đun nóng, phần lớn chất rắn sẽ như thế nào?', options: ['Nở ra', 'Co lại', 'Biến mất', 'Không thay đổi'], answer: 0, explanation: 'Phần lớn chất rắn nở ra khi nóng lên và co lại khi lạnh đi.' },
    { question: 'Năng lượng của vật đang chuyển động được gọi là gì?', options: ['Thế năng', 'Động năng', 'Hóa năng', 'Điện năng'], answer: 1, explanation: 'Vật có năng lượng do chuyển động; dạng năng lượng đó được gọi là động năng.' }
  ],
  'Hóa': [
    { question: 'Khí carbon dioxide có công thức hóa học nào?', options: ['CO', 'CO₂', 'C₂O', 'CaO'], answer: 1, explanation: 'Một phân tử carbon dioxide gồm một nguyên tử carbon và hai nguyên tử oxygen, công thức là CO₂.' },
    { question: 'Nguyên tử trung hòa về điện khi nào?', options: ['Số proton bằng số electron', 'Số proton bằng số neutron', 'Không có electron', 'Số neutron bằng số electron'], answer: 0, explanation: 'Điện tích dương của proton cân bằng điện tích âm của electron khi số proton bằng số electron.' },
    { question: 'Kim loại nào ở thể lỏng ở điều kiện thường?', options: ['Sắt', 'Đồng', 'Thủy ngân', 'Nhôm'], answer: 2, explanation: 'Thủy ngân (Hg) là kim loại ở thể lỏng trong điều kiện thường.' },
    { question: 'Muối ăn thông thường có công thức hóa học là gì?', options: ['NaCl', 'KCl', 'NaOH', 'HCl'], answer: 0, explanation: 'Muối ăn là natri clorua, gồm ion Na⁺ và Cl⁻, có công thức NaCl.' },
    { question: 'Chất nào thường được dùng để nhận biết khí carbon dioxide?', options: ['Nước vôi trong', 'Nước muối', 'Dầu ăn', 'Nước đường'], answer: 0, explanation: 'Carbon dioxide làm nước vôi trong vẩn đục do tạo kết tủa calcium carbonate.' }
  ],
  'Tiếng Anh': [
    { question: 'Choose the correct plural form of “child”.', options: ['childs', 'children', 'childes', 'childrens'], answer: 1, explanation: '“Child” là danh từ bất quy tắc; dạng số nhiều là “children”.' },
    { question: 'Complete the sentence: “They ___ playing football now.”', options: ['is', 'am', 'are', 'be'], answer: 2, explanation: 'Ở thì hiện tại tiếp diễn, chủ ngữ “They” đi với “are”: They are playing.' },
    { question: 'What is the opposite of “early”?', options: ['soon', 'late', 'fast', 'quick'], answer: 1, explanation: 'Từ trái nghĩa phù hợp với “early” (sớm) là “late” (muộn).' },
    { question: 'Choose the correct preposition: “The book is ___ the table.”', options: ['on', 'at', 'for', 'from'], answer: 0, explanation: 'Dùng “on” để diễn tả một vật ở trên bề mặt: “on the table”.' },
    { question: 'Which sentence is in the past simple tense?', options: ['I visit my aunt.', 'I am visiting my aunt.', 'I visited my aunt.', 'I will visit my aunt.'], answer: 2, explanation: '“Visited” là dạng quá khứ của động từ có quy tắc “visit”, nên câu này ở thì quá khứ đơn.' }
  ],
  'Lịch Sử': [
    { question: 'Nhà Trần đã ba lần đánh bại quân xâm lược nào vào thế kỷ XIII?', options: ['Quân Minh', 'Quân Nguyên - Mông', 'Quân Thanh', 'Quân Xiêm'], answer: 1, explanation: 'Nhà Trần lãnh đạo nhân dân Đại Việt ba lần kháng chiến chống quân Nguyên - Mông vào các năm 1258, 1285 và 1287–1288.' },
    { question: 'Hội nghị Diên Hồng được tổ chức dưới triều đại nào?', options: ['Nhà Lý', 'Nhà Trần', 'Nhà Lê sơ', 'Nhà Nguyễn'], answer: 1, explanation: 'Hội nghị Diên Hồng do nhà Trần tổ chức để hỏi ý kiến các bô lão về quyết tâm kháng chiến chống quân Nguyên.' },
    { question: 'Ai là tác giả của “Bình Ngô đại cáo”?', options: ['Nguyễn Trãi', 'Lê Thánh Tông', 'Nguyễn Du', 'Chu Văn An'], answer: 0, explanation: 'Nguyễn Trãi soạn “Bình Ngô đại cáo” năm 1428, tuyên bố thắng lợi của cuộc khởi nghĩa Lam Sơn.' },
    { question: 'Phong trào Tây Sơn bùng nổ vào năm nào?', options: ['1750', '1771', '1789', '1802'], answer: 1, explanation: 'Phong trào Tây Sơn bắt đầu vào năm 1771 tại vùng Tây Sơn, Bình Định ngày nay.' },
    { question: 'Chiến thắng Ngọc Hồi - Đống Đa gắn với vị vua nào?', options: ['Gia Long', 'Quang Trung', 'Lê Chiêu Thống', 'Minh Mạng'], answer: 1, explanation: 'Vua Quang Trung (Nguyễn Huệ) chỉ huy chiến thắng Ngọc Hồi - Đống Đa mùa xuân năm Kỷ Dậu 1789.' }
  ],
  'Khoa học': [
    { question: 'Cơ quan nào giúp con người trao đổi khí khi hô hấp?', options: ['Dạ dày', 'Phổi', 'Tim', 'Gan'], answer: 1, explanation: 'Phổi là cơ quan chính của hệ hô hấp, thực hiện trao đổi oxygen và carbon dioxide giữa cơ thể với môi trường.' },
    { question: 'Nước chuyển từ thể lỏng sang thể khí gọi là quá trình gì?', options: ['Đông đặc', 'Ngưng tụ', 'Bay hơi', 'Nóng chảy'], answer: 2, explanation: 'Bay hơi là quá trình chất lỏng chuyển thành chất khí ở bề mặt chất lỏng.' },
    { question: 'Nguồn năng lượng chính duy trì sự sống trên Trái Đất là gì?', options: ['Mặt Trời', 'Mặt Trăng', 'Gió', 'Thủy triều'], answer: 0, explanation: 'Mặt Trời cung cấp ánh sáng và nhiệt, đồng thời là nguồn năng lượng nền tảng cho nhiều quá trình sống trên Trái Đất.' },
    { question: 'Động vật nào sau đây là động vật có vú?', options: ['Cá chép', 'Ếch đồng', 'Cá voi', 'Thằn lằn'], answer: 2, explanation: 'Cá voi sống dưới nước nhưng là động vật có vú: thở bằng phổi và nuôi con bằng sữa.' },
    { question: 'Lực ma sát thường xuất hiện khi nào?', options: ['Khi hai bề mặt tiếp xúc và chuyển động hoặc có xu hướng chuyển động', 'Chỉ trong không khí', 'Khi một vật đứng riêng lẻ', 'Chỉ khi vật ở dưới nước'], answer: 0, explanation: 'Lực ma sát xuất hiện giữa các bề mặt tiếp xúc, chống lại chuyển động tương đối hoặc xu hướng trượt giữa chúng.' }
  ]
};

Object.entries(extraQuizQuestions).forEach(([subject, questions]) => {
  quizQuestionBank[subject].push(...questions);
});

/* Bộ đếm 10 phút bắt đầu cùng bài làm và tự nộp khi hết giờ. */
let quizSeconds = 10 * 60;
let quizInterval = null;
let quizSubmitted = false;
let currentQuizQuestions = null;
const quizSubjectSelect = document.getElementById('quizSubject');
const quizForm = document.getElementById('quizForm');
const quizResults = document.getElementById('quizResults');
const quizQuestionList = document.getElementById('quizQuestionList');
const quizTimer = document.getElementById('quizTimer');

function updateQuizTimer() {
  const minutes = Math.floor(quizSeconds / 60).toString().padStart(2, '0');
  const seconds = (quizSeconds % 60).toString().padStart(2, '0');
  quizTimer.textContent = `${minutes}:${seconds}`;
  document.getElementById('quizClock').classList.toggle('urgent', quizSeconds <= 60);
}

function resetQuiz() {
  window.clearInterval(quizInterval);
  quizInterval = null;
  quizSeconds = 10 * 60;
  quizSubmitted = false;
  currentQuizQuestions = null;
  updateQuizTimer();
  document.getElementById('quizCurrentSubject').textContent = quizSubjectSelect.value;
  document.getElementById('quizQuestionCount').textContent = '5 câu hỏi';
  document.getElementById('quizPlaceholder').hidden = false;
  quizForm.hidden = true;
  quizResults.hidden = true;
  quizResults.replaceChildren();
  document.getElementById('quizStartButton').disabled = false;
  document.getElementById('quizStartButton').hidden = false;
  document.getElementById('quizStartButton').textContent = 'Bắt đầu làm bài';
}

function chooseQuizQuestions(subject, excludedQuestions = []) {
  const available = quizQuestionBank[subject].filter((question) => !excludedQuestions.includes(question));
  const questionPool = available.length >= 5 ? available : quizQuestionBank[subject];
  return questionPool
    .map((question) => ({ question, sortKey: Math.random() }))
    .sort((a, b) => a.sortKey - b.sortKey)
    .slice(0, 5)
    .map(({ question }) => question);
}

function renderQuizQuestions() {
  const questions = currentQuizQuestions;
  quizQuestionList.replaceChildren();
  questions.forEach((question, questionIndex) => {
    const card = document.createElement('section');
    card.className = 'quiz-question-card';
    const heading = document.createElement('div');
    heading.className = 'quiz-question-heading';
    const number = document.createElement('span');
    number.className = 'quiz-question-number';
    number.textContent = String(questionIndex + 1);
    const prompt = document.createElement('h2');
    prompt.className = 'quiz-question-text';
    prompt.textContent = question.question;
    heading.append(number, prompt);

    const options = document.createElement('div');
    options.className = 'quiz-options';
    question.options.forEach((option, optionIndex) => {
      const label = document.createElement('label');
      label.className = 'quiz-option';
      const input = document.createElement('input');
      input.type = 'radio';
      input.name = `quiz-question-${questionIndex}`;
      input.value = String(optionIndex);
      input.addEventListener('change', updateQuizProgress);
      const letter = document.createElement('span');
      letter.className = 'quiz-option-letter';
      letter.textContent = String.fromCharCode(65 + optionIndex);
      const text = document.createElement('span');
      text.textContent = option;
      label.append(input, letter, text);
      options.append(label);
    });
    card.append(heading, options);
    quizQuestionList.append(card);
  });
  updateQuizProgress();
}

function updateQuizProgress() {
  const answered = currentQuizQuestions
    ? currentQuizQuestions.filter((_, index) => quizForm.querySelector(`input[name="quiz-question-${index}"]:checked`)).length
    : 0;
  document.getElementById('quizProgress').textContent = `Đã trả lời ${answered} / 5 câu`;
}

function clearQuizAnswers() {
  quizForm.querySelectorAll('input[type="radio"]:checked').forEach((input) => {
    input.checked = false;
  });
  updateQuizProgress();
}

function appendQuizReview(parent, question, index, selectedAnswer) {
  const correct = selectedAnswer === question.answer;
  const card = document.createElement('article');
  card.className = `quiz-review-card ${correct ? 'correct' : 'incorrect'}`;
  const title = document.createElement('h3');
  title.className = 'quiz-review-question';
  title.textContent = `${index + 1}. ${question.question}`;
  const result = document.createElement('p');
  result.className = 'quiz-review-line';
  const resultLabel = document.createElement('strong');
  resultLabel.textContent = correct ? '✓ Chính xác' : '✗ Chưa chính xác';
  result.append(resultLabel);
  const userAnswer = document.createElement('p');
  userAnswer.className = 'quiz-review-line';
  userAnswer.textContent = `Bạn chọn: ${selectedAnswer === null ? 'Chưa trả lời' : `${String.fromCharCode(65 + selectedAnswer)}. ${question.options[selectedAnswer]}`}`;
  const correctAnswer = document.createElement('p');
  correctAnswer.className = 'quiz-review-line';
  correctAnswer.textContent = `Đáp án đúng: ${String.fromCharCode(65 + question.answer)}. ${question.options[question.answer]}`;
  const explanation = document.createElement('p');
  explanation.className = 'quiz-explanation';
  explanation.textContent = `Giải thích: ${question.explanation}`;
  card.append(title, result, userAnswer, correctAnswer, explanation);
  parent.append(card);
}

function submitQuiz(isTimeout = false) {
  if (quizSubmitted) return;
  quizSubmitted = true;
  window.clearInterval(quizInterval);
  quizInterval = null;
  const questions = currentQuizQuestions;
  const answers = questions.map((_, index) => {
    const checked = quizForm.querySelector(`input[name="quiz-question-${index}"]:checked`);
    return checked ? Number(checked.value) : null;
  });
  const score = answers.reduce((total, answer, index) => total + Number(answer === questions[index].answer), 0);
  clearQuizAnswers();
  quizForm.hidden = true;
  quizResults.replaceChildren();

  const scoreCard = document.createElement('div');
  scoreCard.className = `quiz-score-card${score >= 4 ? ' quiz-celebration' : ''}`;
  if (score >= 4) {
    ['🎉', '✨', '🎊', '⭐', '🎉'].forEach((emoji) => {
      const confetti = document.createElement('span');
      confetti.className = 'quiz-confetti';
      confetti.setAttribute('aria-hidden', 'true');
      confetti.textContent = emoji;
      scoreCard.append(confetti);
    });
  }
  const scoreTitle = document.createElement('h2');
  scoreTitle.textContent = isTimeout ? 'Đã hết giờ làm bài!' : score >= 4 ? 'Xuất sắc! Bạn làm rất tốt! 🎉' : 'Đã nộp bài, cùng xem lại nhé!';
  const scoreValue = document.createElement('div');
  scoreValue.className = 'quiz-score';
  scoreValue.textContent = `${score} / ${questions.length}`;
  const scoreCaption = document.createElement('p');
  scoreCaption.className = 'quiz-score-caption';
  scoreCaption.textContent = `Bạn trả lời đúng ${score} trên ${questions.length} câu${isTimeout ? ' · Bài đã được tự động nộp khi hết giờ' : ''}.`;
  scoreCard.append(scoreTitle, scoreValue, scoreCaption);
  quizResults.append(scoreCard);

  const reviewTitle = document.createElement('h2');
  reviewTitle.className = 'quiz-review-heading';
  reviewTitle.textContent = 'Đáp án và giải thích chi tiết';
  const reviewList = document.createElement('div');
  reviewList.className = 'quiz-review-list';
  questions.forEach((question, index) => appendQuizReview(reviewList, question, index, answers[index]));
  quizResults.append(reviewTitle, reviewList);
  const actions = document.createElement('div');
  actions.className = 'quiz-result-actions';
  const retryButton = document.createElement('button');
  retryButton.className = 'button button-soft quiz-retry-button';
  retryButton.type = 'button';
  retryButton.textContent = '↺ Làm lại đề này';
  retryButton.addEventListener('click', startQuiz);
  const continueButton = document.createElement('button');
  continueButton.className = 'button button-primary quiz-continue-button';
  continueButton.type = 'button';
  continueButton.textContent = 'Tiếp tục · Bộ câu hỏi mới →';
  continueButton.addEventListener('click', () => {
    currentQuizQuestions = chooseQuizQuestions(quizSubjectSelect.value, currentQuizQuestions);
    startQuiz();
  });
  actions.append(retryButton, continueButton);
  quizResults.append(actions);
  quizResults.hidden = false;
  document.getElementById('quizStartButton').hidden = true;
  quizResults.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function startQuiz() {
  window.clearInterval(quizInterval);
  quizInterval = null;
  if (!currentQuizQuestions) currentQuizQuestions = chooseQuizQuestions(quizSubjectSelect.value);
  quizSeconds = 10 * 60;
  quizSubmitted = false;
  updateQuizTimer();
  document.getElementById('quizCurrentSubject').textContent = quizSubjectSelect.value;
  document.getElementById('quizQuestionCount').textContent = '5 câu hỏi';
  document.getElementById('quizPlaceholder').hidden = true;
  quizResults.hidden = true;
  quizResults.replaceChildren();
  quizForm.reset();
  quizForm.hidden = false;
  renderQuizQuestions();
  document.getElementById('quizStartButton').disabled = true;
  document.getElementById('quizStartButton').hidden = false;
  document.getElementById('quizStartButton').textContent = 'Đang làm bài...';
  quizInterval = window.setInterval(() => {
    quizSeconds -= 1;
    updateQuizTimer();
    if (quizSeconds <= 0) {
      quizSeconds = 0;
      updateQuizTimer();
      submitQuiz(true);
      showToast('Đã hết 10 phút. Bài làm của bạn đã được tự động nộp.');
    }
  }, 1000);
}

quizSubjectSelect.addEventListener('change', resetQuiz);
document.getElementById('quizStartButton').addEventListener('click', () => {
  startQuiz();
});
quizForm.addEventListener('submit', (event) => {
  event.preventDefault();
  submitQuiz(false);
});
updateQuizTimer();
resetQuiz();

renderChat();
renderTasks();
renderCard();
updateTimer();
