# frozen_string_literal: true

module Rooms
  class JitsiCallsController < ApplicationController
    before_action :set_room

    def show
      base = Campfire::Rtc.jitsi_base_url
      return head :not_found if base.blank?
      return head :not_found if @room.direct?

      secret = Rails.application.key_generator.generate_key("campfire/jitsi-room-name")
      digest = OpenSSL::HMAC.hexdigest("SHA256", secret, @room.id.to_s)
      path_segment = "Campfire#{digest}"
      embed_url = "#{base.chomp("/")}/#{path_segment}#config.prejoinPageEnabled=false"
      render json: { embed_url: embed_url }
    end

    private
      def set_room
        @room = Current.user.rooms.find_by(id: params[:room_id])
        head :not_found unless @room
      end
  end
end
