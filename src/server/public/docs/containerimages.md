<topicKey containerimages/>
<topicBack id="topicNext" link="search"/>
<topicNext id="topicBack" link="stats"/>

<a style="float: right;" href="javascript:docNextTopic()">&nbsp;&nbsp;Next&nbsp;<i class="fa fa-lg fa-arrow-right"></i></a>
<a style="float: right;" href="javascript:docNextTopic('toc')">&nbsp;&nbsp;TOC&nbsp;&nbsp;</a>
<a style="float: right;" href="javascript:docPrevTopic()"><i class="fa fa-lg fa-arrow-left"></i>&nbsp;Prev&nbsp;&nbsp;</a>

### Container Images (tab)


Container Images provides a table and graph view of the container images defined within the K8s cluster by Repository name.

From the Repository drop-down select a single repository.  Once a repository has been selected press the "__View selected repository__" button. Pressing this button populates the views.  If this button is not pressed and the Toggle views button is pressed there will be no graph or data shown.

If the View selected repository button is pressed and there is no selected repository a warning message is displayed. 

The successful results are a graph or table view of the container images for the selected repository.  Use the __Toggle Views (table/graph)__ button to toggle between the graph and table views.

Press the blue circle button with an ‘i’ to view additional information regarding this tab.

### Table

In the table view the checkbox fields on the left-hand side of the table can be selected to filter to only the selected rows.  If any rows are selected pressing the button __Graph selected tab rows__ button will limit what is shown in the Graph view.

<p align="center">
  <img style="float: center;" src="docs/docimages/tab_container_images_table.png" width="1024">
</p>

<hr style="border:1px solid #aaaaaa">

### Graph

The graph view is a scrollable view of the selected Repository, Image, Namespace, workload, and Container / Init-Container.  Click any of the icons to view the related resource information.  If no data is available the message 'No resource data available for the selected item.' Will be displayed.

<p align="center">
  <img style="float: center;" src="docs/docimages/tab_container_images_graph.png" width="1024">
</p>

---

#### Graph Icons

The following icons are displayed in the Graph view.  

<p align="center">
  <img style="float: center;" src="docs/docimages/tab_container_images_legend.png">
</p>


<hr style="border:1px solid #aaaaaa">

