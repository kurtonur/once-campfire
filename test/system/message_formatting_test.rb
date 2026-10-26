require "application_system_test_case"

class MessageFormattingTest < ApplicationSystemTestCase
  setup do
    sign_in "jz@37signals.com"
  end

  test "plain JSON is formatted in the current rich text wrapper" do
    message = create_message %(<p>{"items":[1,2],"enabled":true}</p>)

    within_message message do
      assert_selector ".lexxy-content pre.message__structured-text[data-language='json']", text: '"enabled": true'
    end
  end

  test "XML stays text when formatted" do
    xml = '<root><script>alert("example")</script></root>'
    message = create_message "<p>#{ERB::Util.html_escape(xml)}</p>"

    within_message message do
      assert_selector ".lexxy-content pre.message__structured-text[data-language='xml']", text: "<script>"
      assert_no_selector ".message__structured-text script", visible: :all
    end
  end

  test "Lexxy code block line breaks are normalized before JSON formatting" do
    message = create_message %(<pre data-language="json">{"first":1,<br>"second":2}</pre>)

    within_message message do
      assert_selector "pre.message__structured-text[data-language='json']", text: '"second": 2'
      assert_no_selector "pre br", visible: :all
    end
  end

  test "formatting preserves rich message links" do
    message = create_message %(<p>{"link":"<a href="https://example.com/">example</a>"}</p>)

    within_message message do
      assert_selector '.lexxy-content a[href="https://example.com/"]', text: "example"
      assert_no_selector "pre.message__structured-text"
    end
  end

  private
    def create_message(body)
      Message.create!(room: rooms(:designers), body: body, creator: users(:jz)).tap do
        join_room rooms(:designers)
      end
    end
end
