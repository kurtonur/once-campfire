# frozen_string_literal: true

require "test_helper"

class CallSignalingChannelTest < ActionCable::Channel::TestCase
  setup do
    stub_connection(current_user: users(:david))
  end

  test "subscribes on a direct room" do
    room = rooms(:david_and_jason)

    subscribe room_id: room.id

    assert subscription.confirmed?
    assert_has_stream_for room
  end

  test "rejects non-direct rooms" do
    subscribe room_id: rooms(:pets).id

    assert subscription.rejected?
  end

  test "relay broadcasts signaling payload to the room" do
    room = rooms(:david_and_jason)
    subscribe room_id: room.id

    assert_broadcast_on(room, {
      "type" => "offer",
      "call_id" => "test-call",
      "sdp" => "v=0\r\n",
      "video" => false,
      "from_user_id" => users(:david).id
    }) do
      perform :relay, { type: "offer", call_id: "test-call", sdp: "v=0\r\n", video: false }
    end
  end
end
