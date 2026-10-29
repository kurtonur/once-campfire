require "test_helper"

class JitsiCallsChannelTest < ActionCable::Channel::TestCase
  setup do
    stub_connection(current_user: users(:david))
    Campfire::Rtc.stubs(:jitsi_enabled?).returns(true)
  end

  test "subscribes to accessible direct and group rooms" do
    %i[ david_and_jason watercooler ].each do |name|
      subscribe room_id: rooms(name).id
      assert subscription.confirmed?
      assert_has_stream_for rooms(name)
      unsubscribe
    end
  end

  test "rejects another user's room and disabled Jitsi" do
    subscribe room_id: rooms(:bender_and_kevin).id
    assert subscription.rejected?
    Campfire::Rtc.stubs(:jitsi_enabled?).returns(false)
    subscribe room_id: rooms(:watercooler).id
    assert subscription.rejected?
  end

  test "invites contain server-authenticated identity and no client-provided token or URL" do
    room = rooms(:watercooler)
    subscribe room_id: room.id
    assert_broadcast_on(room, { type: "invite", media: "audio", from_user_id: users(:david).id }) do
      perform :invite, media: "audio", from_user_id: users(:kevin).id, url: "https://evil.example", jwt: "fake"
    end
  end

  test "rejects invalid media and revoked membership" do
    subscribe room_id: rooms(:watercooler).id
    assert_no_broadcasts(rooms(:watercooler)) { perform :invite, media: "invalid" }
    memberships(:david_watercooler).destroy!
    assert_no_broadcasts(rooms(:watercooler)) { perform :invite, media: "video" }
  end
end
