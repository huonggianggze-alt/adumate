
/* ==========================================================
   EDUMATE - GEMINI AI INTEGRATION
   GitHub Pages + Cloudflare Worker + Gemini API

   DÁN TOÀN BỘ ĐOẠN NÀY VÀO CUỐI FILE edumate.js
   ========================================================== */

(() => {
  'use strict';

  // THAY URL NÀY BẰNG CLOUDFLARE WORKER CỦA BẠN
  const GEMINI_API_URL =
    'https://edumate-gemini.lan14021999.workers.dev';

  const REQUEST_TIMEOUT = 60000;
  const MAX_MESSAGE_LENGTH = 3000;
  const MAX_HISTORY_MESSAGES = 10;

  let sending = false;

  const form = document.getElementById('chatForm');
  const input = document.getElementById('chatInput');
  const sendButton = document.getElementById('sendChatButton');

  if (!form || !input || !sendButton) {
    console.error(
      '[Edumate Gemini] Không tìm thấy giao diện chat.'
    );
    return;
  }

  // Kiểm tra đã cấu hình URL Worker hay chưa
  function isConfigured() {
    return (
      GEMINI_API_URL.startsWith('https://') &&
      !GEMINI_API_URL.includes('TEN-TAI-KHOAN')
    );
  }

  // Tạo ID cho tin nhắn
  function makeMessageId() {
    if (typeof crypto !== 'undefined' &&
        typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }

    return (
      Date.now() + '-' +
      Math.random().toString(16).slice(2)
    );
  }

  // Tạo lịch sử gửi đến Gemini
  function buildHistory(conversation) {
    if (!conversation ||
        !Array.isArray(conversation.messages)) {
      return [];
    }

    return conversation.messages
      .filter(message => {
        return (
          (message.role === 'user' ||
           message.role === 'assistant') &&
          typeof message.text === 'string' &&
          message.text.trim() !== '' &&
          !message.error &&
          !message.loading
        );
      })
      .slice(-MAX_HISTORY_MESSAGES)
      .map(message => ({
        role: message.role === 'assistant'
          ? 'model'
          : 'user',
        text: message.text.slice(0, MAX_MESSAGE_LENGTH)
      }));
  }

  // Gọi Cloudflare Worker
  async function requestGemini(message, topic, history) {
    const controller = new AbortController();

    const timeout = window.setTimeout(() => {
      controller.abort();
    }, REQUEST_TIMEOUT);

    try {
      const response = await fetch(GEMINI_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message,
          topic,
          history
        }),
        signal: controller.signal
      });

      let data;

      try {
        data = await response.json();
      } catch {
        throw new Error(
          'Máy chủ AI trả về dữ liệu không hợp lệ.'
        );
      }

      if (!response.ok) {
        throw new Error(
          data.error ||
          `Máy chủ AI gặp lỗi (${response.status}).`
        );
      }

      if (
        typeof data.reply !== 'string' ||
        !data.reply.trim()
      ) {
        throw new Error(
          'Gemini chưa tạo được câu trả lời.'
        );
      }

      return data.reply.trim();

    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error(
          'AI phản hồi quá lâu. Hãy thử lại sau.'
        );
      }

      if (error instanceof TypeError) {
        throw new Error(
          'Không kết nối được Cloudflare Worker. ' +
          'Hãy kiểm tra URL, CORS và kết nối mạng.'
        );
      }

      throw error;

    } finally {
      window.clearTimeout(timeout);
    }
  }

  // Đồng bộ trạng thái nút gửi
  function updateGeminiSendButton() {
    const hasText = input.value.trim().length > 0;

    sendButton.disabled = sending || !hasText;
  }

  // Hàm gửi tin nhắn mới
  async function handleGeminiSubmit(event) {
    event.preventDefault();

    // Chặn sự kiện submit cũ trong edumate.js
    event.stopImmediatePropagation();

    if (sending) {
      return;
    }

    const text = input.value.trim();

    if (!text) {
      showToast(
        'Vui lòng nhập câu hỏi.',
        true
      );
      return;
    }

    if (text.length > MAX_MESSAGE_LENGTH) {
      showToast(
        'Câu hỏi tối đa 3000 ký tự.',
        true
      );
      return;
    }

    if (!isConfigured()) {
      showToast(
        'Chưa cấu hình URL Cloudflare Worker.',
        true
      );
      return;
    }

    // Chưa hỗ trợ ảnh ở phiên bản này
    if (pendingImages.length > 0) {
      showToast(
        'Vui lòng xóa ảnh đính kèm trước khi gửi. ' +
        'Phiên bản này chỉ hỗ trợ văn bản.',
        true
      );
      return;
    }

    // Tạo cuộc trò chuyện nếu chưa có
    if (!activeConversation()) {
      createConversation(selectedTopic);
    }

    const conversation = activeConversation();

    if (!conversation) {
      showToast(
        'Không thể tạo cuộc trò chuyện.',
        true
      );
      return;
    }

    const conversationId = conversation.id;

    // Lấy lịch sử trước khi thêm tin nhắn mới
    const history = buildHistory(conversation);

    // Tin nhắn học sinh
    const userMessage = {
      id: makeMessageId(),
      role: 'user',
      text,
      createdAt: new Date().toISOString(),
      attachments: []
    };

    conversation.messages.push(userMessage);

    // Đặt tiêu đề cuộc trò chuyện
    const userCount = conversation.messages.filter(
      message => message.role === 'user'
    ).length;

    if (userCount === 1) {
      conversation.title =
        text.length > 38
          ? text.slice(0, 38).trim() + '…'
          : text;
    }

    // Tin nhắn AI đang chờ
    const aiMessage = {
      id: makeMessageId(),
      role: 'assistant',
      text: '✦ Edumate đang suy nghĩ...',
      createdAt: new Date().toISOString(),
      attachments: [],
      loading: true
    };

    conversation.messages.push(aiMessage);

    // Xóa ô nhập
    input.value = '';
    input.style.height = 'auto';

    // Bật trạng thái đang xử lý
    sending = true;

    updateGeminiSendButton();
    saveChatState();
    renderChat();

    try {
      const reply = await requestGemini(
        text,
        conversation.topic || selectedTopic,
        history
      );

      // Cập nhật tin nhắn AI
      aiMessage.text = reply;
      aiMessage.createdAt =
        new Date().toISOString();

      delete aiMessage.loading;

    } catch (error) {
      console.error(
        '[Edumate Gemini] Lỗi:',
        error
      );

      aiMessage.text =
        'Xin lỗi, mình chưa thể trả lời lúc này.\n\n' +
        error.message;

      aiMessage.error = true;

      delete aiMessage.loading;

      showToast(
        'Không thể nhận câu trả lời từ Gemini.',
        true
      );

    } finally {
      sending = false;

      saveChatState();

      // Chỉ cập nhật khung chat đang mở
      if (activeConversationId === conversationId) {
        renderChat();
      } else {
        renderHistory();
      }

      updateGeminiSendButton();
    }
  }

  // Dùng capture để xử lý trước submit cũ
  form.addEventListener(
    'submit',
    handleGeminiSubmit,
    true
  );

  // Đồng bộ nút gửi khi học sinh nhập văn bản
  input.addEventListener(
    'input',
    updateGeminiSendButton
  );

  // Kiểm tra trạng thái sau khi chọn câu hỏi gợi ý
  document.querySelectorAll('.prompt-chip')
    .forEach(button => {
      button.addEventListener('click', () => {
        updateGeminiSendButton();
      });
    });

  // Trạng thái ban đầu
  updateGeminiSendButton();

  console.info(
    '[Edumate Gemini] Đã khởi tạo tích hợp AI.'
  );
})();
