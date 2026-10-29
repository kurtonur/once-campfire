# frozen_string_literal: true

module Rooms
  class JitsiCallsController < ApplicationController
    before_action :set_room

    def show
      response.headers["Cache-Control"] = "no-store, private"
      return head :not_found unless Campfire::Rtc.jitsi_enabled?

      token = Campfire::Rtc.jitsi_token(room: @room, user: Current.user)
      query = { jwt: token }.to_query
      embed_url = "#{Campfire::Rtc.jitsi_base_url}/#{Campfire::Rtc.jitsi_room_name(@room)}?#{query}#{jitsi_url_fragment}"
      render json: { embed_url: embed_url }
    end

    private
      def set_room
        @room = Current.user.rooms.find_by(id: params[:room_id])
        head :not_found unless @room
      end

      def jitsi_url_fragment
        audio_only = params[:media] == "audio"
        "#config.prejoinConfig.enabled=false&config.startWithAudioMuted=false" \
          "&config.startWithVideoMuted=#{audio_only}&config.startAudioOnly=#{audio_only}"
      end
  end
end
