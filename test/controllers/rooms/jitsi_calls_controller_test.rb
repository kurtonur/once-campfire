require "test_helper"

module Rooms
  class JitsiCallsControllerTest < ActionDispatch::IntegrationTest
    setup do
      @jitsi_env = ENV.to_h.slice(*%w[ CAMPFIRE_JITSI_BASE_URL CAMPFIRE_JITSI_APP_SECRET CAMPFIRE_JITSI_APP_ID CAMPFIRE_JITSI_XMPP_DOMAIN ])
      ENV["CAMPFIRE_JITSI_BASE_URL"] = "https://jitsi.example.com"
      ENV["CAMPFIRE_JITSI_APP_SECRET"] = "test-secret-for-room-scoped-jitsi-tokens"
      ENV["CAMPFIRE_JITSI_APP_ID"] = "campfire"
      ENV["CAMPFIRE_JITSI_XMPP_DOMAIN"] = "meet.jitsi"
      sign_in :david
    end

    teardown do
      %w[ CAMPFIRE_JITSI_BASE_URL CAMPFIRE_JITSI_APP_SECRET CAMPFIRE_JITSI_APP_ID CAMPFIRE_JITSI_XMPP_DOMAIN ].each do |key|
        ENV[key] = @jitsi_env[key]
      end
    end

    test "direct and group calls return signed room-scoped tokens without caching" do
      %i[ david_and_jason watercooler ].each do |name|
        room = rooms(name)
        get room_jitsi_call_path(room), as: :json
        assert_response :success
        assert_includes response.headers["Cache-Control"], "no-store"
        url = URI.parse(response.parsed_body.fetch("embed_url"))
        assert_equal "https", url.scheme
        assert_equal "jitsi.example.com", url.host
        token = Rack::Utils.parse_query(url.query).fetch("jwt")
        payload, header = JWT.decode(token, ENV.fetch("CAMPFIRE_JITSI_APP_SECRET"), true, algorithm: "HS256",
          verify_iss: true, iss: "campfire", verify_aud: true, aud: "campfire")
        assert_equal "HS256", header["alg"]
        assert_equal url.path.delete_prefix("/"), payload["room"]
        assert_equal "meet.jitsi", payload["sub"]
        assert_equal users(:david).id.to_s, payload.dig("context", "user", "id")
        assert_in_delta 1.hour.to_i, payload["exp"] - Time.current.to_i, 5
        assert_not_equal "*", payload["room"]
        assert_no_match ENV.fetch("CAMPFIRE_JITSI_APP_SECRET"), response.body
      end
    end

    test "audio and video use the current Jitsi camera settings and the same room" do
      urls = %w[ audio video ].map do |media|
        get room_jitsi_call_path(rooms(:watercooler)), params: { media: media }, as: :json
        URI.parse(response.parsed_body.fetch("embed_url"))
      end
      assert_equal urls.first.path, urls.last.path
      assert_includes urls.first.fragment, "config.startWithVideoMuted=true"
      assert_includes urls.first.fragment, "config.startAudioOnly=true"
      assert_includes urls.last.fragment, "config.startWithVideoMuted=false"
      assert_includes urls.last.fragment, "config.startAudioOnly=false"
    end

    test "tokens are unavailable for rooms the user cannot access including revoked membership" do
      get room_jitsi_call_path(rooms(:bender_and_kevin)), as: :json
      assert_response :not_found
      memberships(:david_watercooler).destroy!
      get room_jitsi_call_path(rooms(:watercooler)), as: :json
      assert_response :not_found
    end

    test "fails closed without a secret or with an unsafe origin" do
      ENV.delete("CAMPFIRE_JITSI_APP_SECRET")
      get room_jitsi_call_path(rooms(:watercooler)), as: :json
      assert_response :not_found
      ENV["CAMPFIRE_JITSI_APP_SECRET"] = "test-secret"
      %w[ http://jitsi.example.com javascript:alert(1) https://user:password@jitsi.example.com https://jitsi.example.com/other ].each do |url|
        ENV["CAMPFIRE_JITSI_BASE_URL"] = url
        get room_jitsi_call_path(rooms(:watercooler)), as: :json
        assert_response :not_found
      end
    end

    test "requires a signed-in session" do
      delete session_url
      get room_jitsi_call_path(rooms(:watercooler)), as: :json
      assert_response :redirect
    end

    test "direct and group room controls use Jitsi when configured" do
      %i[ david_and_jason watercooler ].each do |name|
        get room_path(rooms(name))
        assert_response :success
        assert_select '[data-controller="jitsi-call"]'
        assert_select '[data-jitsi-call-media-param="audio"]'
        assert_select '[data-jitsi-call-media-param="video"]'
        assert_select '[data-controller="webrtc-call"]', count: 0
        assert_select 'iframe[referrerpolicy="no-referrer"]'
      end
    end
  end
end
