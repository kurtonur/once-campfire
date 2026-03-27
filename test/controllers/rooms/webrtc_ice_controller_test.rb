# frozen_string_literal: true

require "test_helper"

module Rooms
  class WebrtcIceControllerTest < ActionDispatch::IntegrationTest
    setup do
      sign_in :david
    end

    test "show returns ice servers for a direct room" do
      room = rooms(:david_and_jason)

      get room_webrtc_ice_path(room), as: :json

      assert_response :success
      body = JSON.parse(response.body)
      assert_kind_of Array, body["iceServers"]
      assert body["iceServers"].any?
    end

    test "show is not found for non-direct room" do
      get room_webrtc_ice_path(rooms(:pets)), as: :json

      assert_response :not_found
    end
  end
end
